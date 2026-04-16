import { notFound } from 'next/navigation';

import { ChatPage } from '@/components/chat/chat-page';
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

  return (
    <ChatPage
      agentId={resolvedAgent.id}
      agentTitle={resolvedAgent.displayName}
    />
  );
}
