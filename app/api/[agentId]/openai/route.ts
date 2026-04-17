import {
  consumeStream,
  convertToModelMessages,
  type UIMessage,
} from 'ai';

import { resolveRequestedAgent } from '@/lib/agent-registry';

type ChatRequestBody = {
  messages: UIMessage[];
};

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { messages }: ChatRequestBody = await request.json();
  const { agentId } = await context.params;
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
  const result = await resolvedAgent.agent.stream({
    messages: modelMessages,
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    consumeSseStream: consumeStream,
  });
}
