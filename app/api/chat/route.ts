import {
  consumeStream,
  convertToModelMessages,
  type ModelMessage,
  type UIMessage,
} from 'ai';

import { researchAgent } from '@/agents/research';

type ChatRequestBody = {
  messages: UIMessage[];
  continuation?: boolean;
};

const continuationMessage: ModelMessage = {
  role: 'user',
  content:
    '请从上一条助手回复中断的位置继续，不要重复已经完成的内容。只补全后续内容。',
};

export async function POST(request: Request): Promise<Response> {
  const { messages, continuation }: ChatRequestBody = await request.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = await researchAgent.stream({
    messages:
      continuation === true
        ? [...modelMessages, continuationMessage]
        : modelMessages,
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    consumeSseStream: consumeStream,
  });
}
