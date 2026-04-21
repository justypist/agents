import { createChatSession } from '@/lib/chat-sessions';
import { resolveRequestedAgent } from '@/lib/agent-registry';

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { agentId } = await context.params;
  const resolvedAgent = await resolveRequestedAgent(agentId);

  if (resolvedAgent == null) {
    return Response.json({ error: 'Unknown agentId' }, { status: 400 });
  }

  const sessionId = await createChatSession(resolvedAgent.id);

  return Response.json(
    {
      agentId: resolvedAgent.id,
      sessionId,
      chatPath: `/${resolvedAgent.routeSegment}/${sessionId}`,
      apiPath: `/api/${resolvedAgent.id}/${sessionId}`,
    },
    {
      status: 201,
    },
  );
}
