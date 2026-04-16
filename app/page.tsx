import { ChatPage } from '@/components/chat/chat-page';
import { resolveRequestedAgent } from '@/lib/agent-registry';

export default async function Home() {
  const defaultAgent = await resolveRequestedAgent(undefined);

  if (defaultAgent == null) {
    throw new Error('Default agent is not configured.');
  }

  return (
    <ChatPage
      agentId={defaultAgent.id}
      agentTitle={defaultAgent.displayName}
    />
  );
}
