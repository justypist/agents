import 'server-only';

import {
  consumeStream,
  convertToModelMessages,
  createIdGenerator,
  type UIMessage,
  validateUIMessages,
} from 'ai';

import { jsonError } from '@/lib/api/responses';
import { resolveRequestedAgent } from '@/lib/agent-registry';
import { getChatSession, saveChatSessionMessages } from '@/lib/chat-session';

const generateMessageId = createIdGenerator({
  prefix: 'msg',
  size: 16,
});

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

  const validatedMessages = await validateUIMessages({
    messages: input.messages,
  });
  const modelMessages = await convertToModelMessages(validatedMessages);
  const result = await resolvedAgent.agent.stream({
    messages: modelMessages,
    abortSignal: input.abortSignal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
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
