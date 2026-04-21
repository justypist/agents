import { notFound, redirect } from 'next/navigation';

import { createChatSession } from '@/lib/chat-sessions';
import { getAgentByRouteSegment, getRouteAgents } from '@/lib/agent-registry';

type AgentPageProps = {
  params: Promise<{
    agent: string;
  }>;
};

export async function generateStaticParams(): Promise<
  Array<{
    agent: string;
  }>
> {
  const routeAgents = await getRouteAgents();

  return routeAgents.map(agent => ({
    agent: agent.routeSegment!,
  }));
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { agent } = await params;
  const resolvedAgent = await getAgentByRouteSegment(agent);

  if (resolvedAgent == null) {
    notFound();
  }

  const sessionId = await createChatSession(resolvedAgent.id);

  redirect(`/${resolvedAgent.routeSegment}/${sessionId}`);
}
