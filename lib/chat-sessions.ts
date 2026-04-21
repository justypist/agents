import 'server-only';

import { generateId, type UIMessage } from 'ai';
import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { chatSessions } from '@/lib/db/schema';

export type StoredChatSession = {
  id: string;
  agentId: string;
  messages: UIMessage[];
};

export async function createChatSession(agentId: string): Promise<string> {
  const id = generateId();
  const now = new Date();

  await getDb().insert(chatSessions).values({
    id,
    agentId,
    messages: '[]',
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function getChatSession(
  sessionId: string,
): Promise<StoredChatSession | null> {
  const session = await getDb().query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  });

  if (session == null) {
    return null;
  }

  return {
    id: session.id,
    agentId: session.agentId,
    messages: parseMessages(session.messages),
  };
}

export async function saveChatSessionMessages(input: {
  sessionId: string;
  messages: UIMessage[];
}): Promise<void> {
  await getDb()
    .update(chatSessions)
    .set({
      messages: JSON.stringify(input.messages),
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, input.sessionId));
}

function parseMessages(value: string): UIMessage[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed as UIMessage[];
}
