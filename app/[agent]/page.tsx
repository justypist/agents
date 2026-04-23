import { notFound, redirect } from 'next/navigation';

import { createChatSession } from '@/lib/chat-session';
import { getAgentByRouteSegment } from '@/lib/agent-registry';

export const dynamic = 'force-dynamic';

type AgentPageProps = {
  params: Promise<{
    agent: string;
  }>;
};

export default async function AgentPage({ params }: AgentPageProps) {
  const { agent } = await params;
  const resolvedAgent = await getAgentByRouteSegment(agent);

  if (resolvedAgent == null) {
    notFound();
  }

  const sessionId = await createChatSession(resolvedAgent.id);

  redirect(`/${resolvedAgent.routeSegment}/${sessionId}`);
}
