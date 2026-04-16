import {
  consumeStream,
  convertToModelMessages,
  type ModelMessage,
  type UIMessage,
} from 'ai';

import { resolveRequestedAgent } from '@/lib/agent-registry';

type ChatRequestBody = {
  messages: UIMessage[];
  continuation?: boolean;
  agentId?: string;
};

const continuationMessage: ModelMessage = {
  role: 'user',
  content:
    '请从上一条助手回复中断的位置继续，不要重复已经完成的内容。只补全后续内容。',
};

export async function POST(request: Request): Promise<Response> {
  const { messages, continuation, agentId }: ChatRequestBody =
    await request.json();
  const resolvedAgent = await resolveRequestedAgent(agentId);

  if (resolvedAgent == null) {
    return Response.json(
      {
        error: 'Unknown agentId',
      },
      {
        status: 400,
      },
    );
  }

  const modelMessages = await convertToModelMessages(messages);
  const streamMessages =
    continuation === true
      ? [...modelMessages, continuationMessage]
      : modelMessages;
  const result = await resolvedAgent.agent.stream({
    messages: streamMessages,
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    consumeSseStream: consumeStream,
  });
}
