import 'server-only';

import { generateId, type UIMessage } from 'ai';
import { desc, eq, isNull, sql } from 'drizzle-orm';

import { getRouteAgents } from '@/lib/agent-registry';
import { getDb } from '@/lib/db';
import { chatSessions } from '@/lib/db/schema';
import { generateChatSessionTitle } from '@/lib/naming-agent';

export const CHAT_SESSION_PAGE_SIZE = 10;

export type StoredChatSession = {
  id: string;
  agentId: string;
  title: string | null;
  messages: UIMessage[];
};

export type ChatSessionListItem = {
  id: string;
  agentId: string;
  title: string;
  previewText: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  updatedAtLabel: string;
  archivedAt: string | null;
};

export type ChatSessionListPage = {
  items: ChatSessionListItem[];
  hasMore: boolean;
};

export type HomeChatSessionItem = ChatSessionListItem & {
  agentDisplayName: string;
  chatPath: string;
};

export type HomeChatSessionListPage = {
  items: HomeChatSessionItem[];
  hasMore: boolean;
};

let ensureChatSessionsSchemaPromise: Promise<void> | null = null;

export async function createChatSession(agentId: string): Promise<string> {
  await ensureChatSessionsSchema();

  const id = generateId();
  const now = new Date();

  await getDb().insert(chatSessions).values({
    id,
    agentId,
    title: null,
    messages: '[]',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function getChatSession(
  sessionId: string,
): Promise<StoredChatSession | null> {
  await ensureChatSessionsSchema();

  const session = await getDb().query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  });

  if (session == null) {
    return null;
  }

  return {
    id: session.id,
    agentId: session.agentId,
    title: session.title,
    messages: parseMessages(session.messages),
  };
}

export async function saveChatSessionMessages(input: {
  sessionId: string;
  messages: UIMessage[];
}): Promise<void> {
  await ensureChatSessionsSchema();

  const existingSession = await getDb().query.chatSessions.findFirst({
    columns: {
      title: true,
    },
    where: eq(chatSessions.id, input.sessionId),
  });
  const nextTitle =
    existingSession?.title ?? (await generateChatSessionTitle(input.messages));

  await getDb()
    .update(chatSessions)
    .set({
      title: nextTitle,
      messages: JSON.stringify(input.messages),
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, input.sessionId));
}

export async function listChatSessions(input: {
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<ChatSessionListPage> {
  await ensureChatSessionsSchema();

  const includeArchived = input.includeArchived ?? false;
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const offset = (page - 1) * pageSize;
  const rows = await getDb()
    .select({
      id: chatSessions.id,
      agentId: chatSessions.agentId,
      title: chatSessions.title,
      messages: chatSessions.messages,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
      archivedAt: chatSessions.archivedAt,
    })
    .from(chatSessions)
    .where(includeArchived ? sql`${chatSessions.archivedAt} is not null` : isNull(chatSessions.archivedAt))
    .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.id))
    .limit(pageSize + 1)
    .offset(offset);
  const visibleRows = rows.slice(0, pageSize);

  return {
    items: visibleRows.map(row => {
      const messages = parseMessages(row.messages);
      const preview = buildSessionPreview(messages);

      return {
        id: row.id,
        agentId: row.agentId,
        title: row.title ?? preview.title,
        previewText: preview.previewText,
        messageCount: messages.length,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        updatedAtLabel: formatSessionTime(row.updatedAt),
        archivedAt: row.archivedAt?.toISOString() ?? null,
      };
    }),
    hasMore: rows.length > pageSize,
  };
}

export async function listHomeChatSessions(input: {
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<HomeChatSessionListPage> {
  const [agents, sessions] = await Promise.all([
    getRouteAgents(),
    listChatSessions(input),
  ]);
  const agentsById = new Map(agents.map(agent => [agent.id, agent]));

  return {
    items: sessions.items.flatMap(session => {
      const agent = agentsById.get(session.agentId);

      if (agent?.routeSegment == null) {
        return [];
      }

      return [
        {
          ...session,
          agentDisplayName: agent.displayName,
          chatPath: `/${agent.routeSegment}/${session.id}`,
        },
      ];
    }),
    hasMore: sessions.hasMore,
  };
}

export async function setChatSessionArchived(input: {
  sessionId: string;
  archived: boolean;
}): Promise<boolean> {
  await ensureChatSessionsSchema();

  const existingSession = await getDb().query.chatSessions.findFirst({
    columns: {
      id: true,
    },
    where: eq(chatSessions.id, input.sessionId),
  });

  if (existingSession == null) {
    return false;
  }

  await getDb()
    .update(chatSessions)
    .set({
      archivedAt: input.archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, input.sessionId));

  return true;
}

export async function regenerateChatSessionTitle(input: {
  sessionId: string;
}): Promise<string | null | undefined> {
  await ensureChatSessionsSchema();

  const existingSession = await getDb().query.chatSessions.findFirst({
    columns: {
      id: true,
      messages: true,
    },
    where: eq(chatSessions.id, input.sessionId),
  });

  if (existingSession == null) {
    return undefined;
  }

  const messages = parseMessages(existingSession.messages);
  const nextTitle = await generateChatSessionTitle(messages);

  if (nextTitle == null) {
    return null;
  }

  await getDb()
    .update(chatSessions)
    .set({
      title: nextTitle,
      updatedAt: new Date(),
    })
    .where(eq(chatSessions.id, input.sessionId));

  return nextTitle;
}

async function ensureChatSessionsSchema(): Promise<void> {
  if (ensureChatSessionsSchemaPromise != null) {
    return ensureChatSessionsSchemaPromise;
  }

  ensureChatSessionsSchemaPromise = (async () => {
    const result = await getDb().$client.execute("PRAGMA table_info('chat_sessions')");
    const hasArchivedAtColumn = result.rows.some(row => row.name === 'archived_at');
    const hasTitleColumn = result.rows.some(row => row.name === 'title');

    if (!hasArchivedAtColumn) {
      await getDb().$client.execute(
        'ALTER TABLE chat_sessions ADD COLUMN archived_at integer',
      );
    }

    if (!hasTitleColumn) {
      await getDb().$client.execute(
        'ALTER TABLE chat_sessions ADD COLUMN title text',
      );
    }
  })().catch(error => {
    ensureChatSessionsSchemaPromise = null;
    throw error;
  });

  return ensureChatSessionsSchemaPromise;
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

function normalizePage(page: number | undefined): number {
  if (page == null || !Number.isFinite(page)) {
    return 1;
  }

  return Math.max(1, Math.floor(page));
}

function normalizePageSize(pageSize: number | undefined): number {
  if (pageSize == null || !Number.isFinite(pageSize)) {
    return CHAT_SESSION_PAGE_SIZE;
  }

  return Math.min(Math.max(1, Math.floor(pageSize)), 50);
}

function buildSessionPreview(messages: UIMessage[]): {
  title: string;
  previewText: string;
} {
  const preferredText =
    findMessageText(messages, 'user') ??
    findMessageText(messages, 'assistant') ??
    '空白会话';
  const normalizedText = normalizePreviewText(preferredText);

  return {
    title: truncateText(normalizedText, 48),
    previewText: truncateText(normalizedText, 96),
  };
}

function findMessageText(
  messages: UIMessage[],
  role: UIMessage['role'],
): string | null {
  for (const message of messages) {
    if (message.role !== role) {
      continue;
    }

    for (const part of message.parts) {
      if (part.type !== 'text') {
        continue;
      }

      const text = normalizePreviewText(part.text);

      if (text.length > 0) {
        return text;
      }
    }
  }

  return null;
}

function normalizePreviewText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatSessionTime(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}
