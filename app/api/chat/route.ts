import { convertToModelMessages, type UIMessage } from 'ai';

import { researchAgent } from '@/agents/research';

type ChatRequestBody = {
  messages: UIMessage[];
};

export async function POST(request: Request): Promise<Response> {
  const { messages }: ChatRequestBody = await request.json();

  const result = await researchAgent.stream({
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
