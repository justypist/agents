import { createChatSession } from '@/lib/chat-session';
import { resolveRequestedAgent } from '@/lib/agent-registry';
import { jsonCreated, jsonError } from '@/lib/api/responses';

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
    return jsonError('Unknown agentId', 400);
  }

  const sessionId = await createChatSession(resolvedAgent.id);

  return jsonCreated({
    agentId: resolvedAgent.id,
    sessionId,
    chatPath: `/${resolvedAgent.routeSegment}/${sessionId}`,
    apiPath: `/api/${resolvedAgent.id}/${sessionId}`,
  });
}
