import 'server-only';

import {
  consumeStream,
  convertToModelMessages,
  createIdGenerator,
  type ModelMessage,
  type UIMessage,
  validateUIMessages,
} from 'ai';

import { jsonError } from '@/lib/api/responses';
import { resolveRequestedAgent, type RegisteredAgent } from '@/lib/agent-registry';
import { getChatSession, saveChatSessionMessages } from '@/lib/chat-session';
import { parseSkillInvocationPrefix } from '@/lib/chat/skill-invocation';
import { getEnabledSkillByName, type Skill } from '@/lib/skills';

const generateMessageId = createIdGenerator({
  prefix: 'msg',
  size: 16,
});

type AgentStreamResult = Awaited<ReturnType<RegisteredAgent['agent']['stream']>>;

type PreparedAgentTurn = {
  validatedMessages: UIMessage[];
  streamResult: AgentStreamResult;
};

type PrepareAgentTurnResult = PreparedAgentTurn | Response;

export async function generateAgentReplyMessages(input: {
  agent: RegisteredAgent['agent'];
  messages: UIMessage[];
}): Promise<UIMessage[]> {
  const preparedTurn = await prepareAgentTurn(input);

  if (preparedTurn instanceof Response) {
    throw new Error('Agent reply preparation failed.');
  }

  let finishedMessages: UIMessage[] | null = null;
  const stream = preparedTurn.streamResult.toUIMessageStream({
    originalMessages: preparedTurn.validatedMessages,
    generateMessageId,
    sendReasoning: true,
    onFinish: (event: { messages: UIMessage[] }) => {
      finishedMessages = event.messages;
    },
  });

  await consumeStream({ stream });

  if (finishedMessages == null) {
    throw new Error('Agent reply finished without messages.');
  }

  return finishedMessages;
}

export async function streamChatSessionTurn(input: {
  agentId: string;
  sessionId: string;
  requestSessionId?: string;
  messages: UIMessage[];
  abortSignal?: AbortSignal;
}): Promise<Response> {
  const resolvedAgent = await resolveRequestedAgent(input.agentId);

  if (resolvedAgent == null) {
    return jsonError('Unknown agentId', 400);
  }

  if (input.requestSessionId != null && input.requestSessionId !== input.sessionId) {
    return jsonError('Mismatched sessionId', 400);
  }

  const session = await getChatSession(input.sessionId);

  if (session == null) {
    return jsonError('Unknown sessionId', 404);
  }

  if (session.agentId !== resolvedAgent.id) {
    return jsonError('Session does not belong to agentId', 400);
  }

  const preparedTurn = await prepareAgentTurn({
    agent: resolvedAgent.agent,
    messages: input.messages,
    abortSignal: input.abortSignal,
  });

  if (preparedTurn instanceof Response) {
    return preparedTurn;
  }

  return preparedTurn.streamResult.toUIMessageStreamResponse({
    originalMessages: preparedTurn.validatedMessages,
    generateMessageId,
    sendReasoning: true,
    consumeSseStream: consumeStream,
    onFinish: async (event: { messages: UIMessage[] }) => {
      await saveChatSessionMessages({
        sessionId: input.sessionId,
        messages: event.messages,
      });
    },
  });
}

async function prepareAgentTurn(input: {
  agent: RegisteredAgent['agent'];
  messages: UIMessage[];
  abortSignal?: AbortSignal;
}): Promise<PrepareAgentTurnResult> {
  const validatedMessages = await validateUIMessages({
    messages: input.messages,
  });
  const skillInvocation = await resolveSkillInvocation(validatedMessages);

  if (skillInvocation instanceof Response) {
    return skillInvocation;
  }

  const modelMessages = await convertToModelMessages(skillInvocation.messages);
  const messagesWithSkill = addSkillSystemMessage(
    modelMessages,
    skillInvocation.skill,
    skillInvocation.taskText,
  );

  return {
    validatedMessages,
    streamResult: await input.agent.stream({
      messages: messagesWithSkill,
      abortSignal: input.abortSignal,
    }),
  };
}

async function resolveSkillInvocation(messages: UIMessage[]): Promise<
  | {
      messages: UIMessage[];
      skill: Skill | null;
      taskText: string | null;
    }
  | Response
> {
  const lastUserText = findLastUserTextPart(messages);

  if (lastUserText == null) {
    return { messages, skill: null, taskText: null };
  }

  const invocation = parseSkillInvocationPrefix(lastUserText.text);

  if (invocation == null) {
    return { messages, skill: null, taskText: null };
  }

  const skill = await getEnabledSkillByName(invocation.name);

  if (skill == null) {
    return jsonError(`Skill "${invocation.name}" is not available`, 400);
  }

  return {
    messages: replaceMessageTextPart(
      messages,
      lastUserText.messageIndex,
      lastUserText.partIndex,
      invocation.taskText,
    ),
    skill,
    taskText: invocation.taskText,
  };
}

function findLastUserTextPart(messages: UIMessage[]): {
  messageIndex: number;
  partIndex: number;
  text: string;
} | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];

    if (message?.role !== 'user') {
      continue;
    }

    for (let partIndex = 0; partIndex < message.parts.length; partIndex += 1) {
      const part = message.parts[partIndex];

      if (part?.type === 'text') {
        return { messageIndex, partIndex, text: part.text };
      }
    }
  }

  return null;
}

function replaceMessageTextPart(
  messages: UIMessage[],
  messageIndex: number,
  partIndex: number,
  text: string,
): UIMessage[] {
  return messages.map((message, currentMessageIndex) => {
    if (currentMessageIndex !== messageIndex) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part, currentPartIndex) =>
        currentPartIndex === partIndex && part.type === 'text'
          ? { ...part, text }
          : part,
      ),
    };
  });
}

function addSkillSystemMessage(
  messages: ModelMessage[],
  skill: Skill | null,
  taskText: string | null,
): ModelMessage[] {
  if (skill == null) {
    return messages;
  }

  return [
    {
      role: 'system',
      content: [
        `本轮用户显式调用数据库 skill /${skill.name}。`,
        '你必须把下面的 skill 内容作为本轮任务的工作说明，但仍需结合用户剩余任务文本回答。',
        `Skill 标题：${skill.displayName}`,
        `Skill 描述：${skill.description}`,
        'Skill 正文：',
        skill.content,
        '',
        `用户剩余任务文本：${taskText ?? ''}`,
      ].join('\n'),
    },
    ...messages,
  ];
}
