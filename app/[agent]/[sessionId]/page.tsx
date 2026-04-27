import { notFound } from 'next/navigation';

import { ChatPage } from '@/components/chat/chat-page';
import type { SkillView } from '@/components/skills/types';
import { getAgentByRouteSegment } from '@/lib/agent-registry';
import { getChatSession } from '@/lib/chat-session';
import { listSkills, type Skill } from '@/lib/skills';

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

  const [session, skills] = await Promise.all([
    getChatSession(sessionId),
    listSkills(),
  ]);

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
      initialSkills={skills.map(serializeSkill)}
    />
  );
}

function serializeSkill(skill: Skill): SkillView {
  return {
    id: skill.id,
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    content: skill.content,
    status: skill.status,
    sourceSessionId: skill.sourceSessionId,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}
