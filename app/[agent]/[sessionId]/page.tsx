import { notFound } from 'next/navigation';

import { ChatPage } from '@/components/chat/chat-page';
import { getAgentByRouteSegment } from '@/lib/agent-registry';
import { getChatSession } from '@/lib/chat-session';

type ChatSessionPageProps = {
  params: Promise<{
    agent: string;
    sessionId: string;
  }>;
};

export default async function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { agent, sessionId } = await params;
  const resolvedAgent = await getAgentByRouteSegment(agent);

  if (resolvedAgent == null) {
    notFound();
  }

  const session = await getChatSession(sessionId);

  if (session == null || session.agentId !== resolvedAgent.id) {
    notFound();
  }

  return (
    <ChatPage
      agentId={resolvedAgent.id}
      sessionId={session.id}
      initialMessages={session.messages}
      initialTitle={session.title}
      fallbackTitle={resolvedAgent.displayName}
    />
  );
}
