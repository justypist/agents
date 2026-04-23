import {
  consumeStream,
  convertToModelMessages,
  createIdGenerator,
  type UIMessage,
  validateUIMessages,
} from 'ai';

import { resolveRequestedAgent } from '@/lib/agent-registry';
import { getChatSession, saveChatSessionMessages } from '@/lib/chat-session';

type ChatRequestBody = {
  id?: string;
  messages: UIMessage[];
};

type RouteContext = {
  params: Promise<{
    agentId: string;
    sessionId: string;
  }>;
};

const generateMessageId = createIdGenerator({
  prefix: 'msg',
  size: 16,
});

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id, messages }: ChatRequestBody = await request.json();
  const { agentId, sessionId } = await context.params;
  const resolvedAgent = await resolveRequestedAgent(agentId);

  if (resolvedAgent == null) {
    return Response.json({ error: 'Unknown agentId' }, { status: 400 });
  }

  if (id != null && id !== sessionId) {
    return Response.json({ error: 'Mismatched sessionId' }, { status: 400 });
  }

  const session = await getChatSession(sessionId);

  if (session == null) {
    return Response.json({ error: 'Unknown sessionId' }, { status: 404 });
  }

  if (session.agentId !== resolvedAgent.id) {
    return Response.json(
      { error: 'Session does not belong to agentId' },
      { status: 400 },
    );
  }

  const validatedMessages = await validateUIMessages({
    messages,
  });
  const modelMessages = await convertToModelMessages(validatedMessages);
  const result = await resolvedAgent.agent.stream({
    messages: modelMessages,
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    generateMessageId,
    sendReasoning: true,
    consumeSseStream: consumeStream,
    onFinish: async (event: { messages: UIMessage[] }) => {
      await saveChatSessionMessages({
        sessionId,
        messages: event.messages,
      });
    },
  });
}
