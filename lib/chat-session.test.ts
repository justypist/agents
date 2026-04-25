/** @vitest-environment node */

import type { UIMessage } from 'ai';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chatSessions } from '@/lib/db/schema';

type ChatSessionModule = typeof import('./chat-session');
type DbModule = typeof import('@/lib/db');

const generatedTitle = vi.fn<() => Promise<string | null>>();

vi.mock('@/lib/naming-agent', () => ({
  generateChatSessionTitle: generatedTitle,
}));

vi.mock('@/lib/agent-registry', () => ({
  getRouteAgents: vi.fn(async () => [
    {
      id: 'default',
      displayName: 'Agents',
      routeSegment: 'default',
      agent: {
        stream: async () => ({
          toUIMessageStreamResponse: () => new Response(null),
        }),
      },
    },
    {
      id: 'other',
      displayName: 'Other',
      routeSegment: 'other',
      agent: {
        stream: async () => ({
          toUIMessageStreamResponse: () => new Response(null),
        }),
      },
    },
  ]),
}));

let previousDatabaseUrl: string | undefined;
let testDatabaseUrl: string;
let testSchemaName: string | null = null;
let loadedDbModule: DbModule | null = null;

beforeEach(() => {
  vi.resetModules();
  generatedTitle.mockResolvedValue('Generated title');
  previousDatabaseUrl = process.env.DATABASE_URL;
  testDatabaseUrl =
    process.env.TEST_DATABASE_URL?.trim() ||
    'postgres://agents:agents@localhost:5432/agents';
  testSchemaName = `chat_session_test_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  process.env.DATABASE_URL = withSearchPath(testDatabaseUrl, testSchemaName);
});

afterEach(async () => {
  await loadedDbModule?.closeDb();
  loadedDbModule = null;

  await dropTestSchema();

  if (previousDatabaseUrl == null) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

async function loadModules(): Promise<{
  chatSession: ChatSessionModule;
  db: DbModule;
}> {
  await createTestSchema();

  const [chatSession, db] = await Promise.all([
    import('./chat-session'),
    import('@/lib/db'),
  ]);
  loadedDbModule = db;

  await db.getDb().execute(sql`
    CREATE TABLE chat_sessions (
      id text PRIMARY KEY NOT NULL,
      agent_id text NOT NULL,
      title text,
      messages text NOT NULL,
      archived_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL,
      updated_at timestamp with time zone NOT NULL
    )
  `);

  return { chatSession, db };
}

async function insertSession(input: {
  db: ReturnType<DbModule['getDb']>;
  id: string;
  agentId?: string;
  title?: string | null;
  messages: unknown;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}): Promise<void> {
  const now = new Date('2026-01-01T00:00:00.000Z');

  await input.db.insert(chatSessions).values({
    id: input.id,
    agentId: input.agentId ?? 'default',
    title: input.title ?? null,
    messages:
      typeof input.messages === 'string'
        ? input.messages
        : JSON.stringify(input.messages),
    archivedAt: input.archivedAt ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
}

async function createTestSchema(): Promise<void> {
  if (testSchemaName == null) {
    return;
  }

  const admin = postgres(testDatabaseUrl, { max: 1 });

  try {
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS ${testSchemaName}`);
  } finally {
    await admin.end();
  }
}

async function dropTestSchema(): Promise<void> {
  if (testSchemaName == null) {
    return;
  }

  const admin = postgres(testDatabaseUrl, { max: 1 });

  try {
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${testSchemaName} CASCADE`);
  } finally {
    await admin.end();
    testSchemaName = null;
  }
}

function withSearchPath(databaseUrl: string, schemaName: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set('options', `-c search_path=${schemaName}`);
  return url.toString();
}

function textMessage(id: string, text: string, role: UIMessage['role'] = 'user'): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  };
}

describe('chat-session persistence', () => {
  it('creates sessions and reads stored messages', async () => {
    const { chatSession, db } = await loadModules();
    const sessionId = await chatSession.createChatSession('default');

    expect(sessionId).toEqual(expect.any(String));
    await expect(chatSession.getChatSession(sessionId)).resolves.toEqual({
      id: sessionId,
      agentId: 'default',
      title: null,
      messages: [],
    });

    await insertSession({
      db: db.getDb(),
      id: 'manual-session',
      messages: [textMessage('message-1', 'hello')],
    });

    await expect(chatSession.getChatSession('manual-session')).resolves.toEqual({
      id: 'manual-session',
      agentId: 'default',
      title: null,
      messages: [textMessage('message-1', 'hello')],
    });
    await expect(chatSession.getChatSession('missing')).resolves.toBeNull();
  });

  it('falls back to an empty message array for malformed stored JSON', async () => {
    const { chatSession, db } = await loadModules();

    await insertSession({
      db: db.getDb(),
      id: 'bad-json',
      messages: '{bad',
    });
    await insertSession({
      db: db.getDb(),
      id: 'not-array',
      messages: JSON.stringify({ nope: true }),
    });

    await expect(chatSession.getChatSession('bad-json')).resolves.toMatchObject({
      messages: [],
    });
    await expect(chatSession.getChatSession('not-array')).resolves.toMatchObject({
      messages: [],
    });
  });

  it('saves messages and generates titles only when needed', async () => {
    const { chatSession, db } = await loadModules();

    await insertSession({
      db: db.getDb(),
      id: 'untitled',
      title: null,
      messages: [],
    });
    await chatSession.saveChatSessionMessages({
      sessionId: 'untitled',
      messages: [textMessage('message-1', 'hello')],
    });

    await expect(chatSession.getChatSession('untitled')).resolves.toMatchObject({
      title: 'Generated title',
      messages: [textMessage('message-1', 'hello')],
    });
    expect(generatedTitle).toHaveBeenCalledTimes(1);

    await insertSession({
      db: db.getDb(),
      id: 'titled',
      title: 'Existing title',
      messages: [],
    });
    await chatSession.saveChatSessionMessages({
      sessionId: 'titled',
      messages: [textMessage('message-2', 'next')],
    });

    await expect(chatSession.getChatSession('titled')).resolves.toMatchObject({
      title: 'Existing title',
    });
    expect(generatedTitle).toHaveBeenCalledTimes(1);
  });

  it('lists active and archived sessions with pagination metadata', async () => {
    const { chatSession, db } = await loadModules();
    const database = db.getDb();

    await insertSession({
      db: database,
      id: 'old-active',
      messages: [textMessage('message-1', 'old active')],
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await insertSession({
      db: database,
      id: 'new-active',
      messages: [textMessage('message-2', 'new active')],
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    await insertSession({
      db: database,
      id: 'archived',
      messages: [textMessage('message-3', 'archived text')],
      archivedAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    await expect(
      chatSession.listChatSessions({ page: 1, pageSize: 1 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'new-active',
          title: 'new active',
          previewText: 'new active',
          messageCount: 1,
          archivedAt: null,
        },
      ],
      hasMore: true,
    });

    await expect(
      chatSession.listChatSessions({ includeArchived: true }),
    ).resolves.toMatchObject({
      items: [
        {
          id: 'archived',
          title: 'archived text',
          archivedAt: '2026-01-03T00:00:00.000Z',
        },
      ],
      hasMore: false,
    });
  });

  it('builds home session links only for registered route agents', async () => {
    const { chatSession, db } = await loadModules();

    await insertSession({
      db: db.getDb(),
      id: 'default-session',
      agentId: 'default',
      messages: [textMessage('message-1', 'hello')],
    });
    await insertSession({
      db: db.getDb(),
      id: 'unknown-session',
      agentId: 'missing',
      messages: [textMessage('message-2', 'hidden')],
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await expect(chatSession.listHomeChatSessions({})).resolves.toMatchObject({
      items: [
        {
          id: 'default-session',
          agentDisplayName: 'Agents',
          chatPath: '/default/default-session',
        },
      ],
    });
  });

  it('archives sessions and regenerates titles', async () => {
    const { chatSession, db } = await loadModules();

    await insertSession({
      db: db.getDb(),
      id: 'session-1',
      title: null,
      messages: [textMessage('message-1', 'hello')],
    });

    await expect(
      chatSession.setChatSessionArchived({ sessionId: 'missing', archived: true }),
    ).resolves.toBe(false);
    await expect(
      chatSession.setChatSessionArchived({ sessionId: 'session-1', archived: true }),
    ).resolves.toBe(true);
    await expect(
      chatSession.listChatSessions({ includeArchived: true }),
    ).resolves.toMatchObject({
      items: [{ id: 'session-1' }],
    });

    await expect(
      chatSession.regenerateChatSessionTitle({ sessionId: 'missing' }),
    ).resolves.toBeUndefined();
    generatedTitle.mockResolvedValueOnce(null);
    await expect(
      chatSession.regenerateChatSessionTitle({ sessionId: 'session-1' }),
    ).resolves.toBeNull();
    generatedTitle.mockResolvedValueOnce('Fresh title');
    await expect(
      chatSession.regenerateChatSessionTitle({ sessionId: 'session-1' }),
    ).resolves.toBe('Fresh title');
    await expect(chatSession.getChatSession('session-1')).resolves.toMatchObject({
      title: 'Fresh title',
    });
  });
});
