/** @vitest-environment node */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { UIMessage } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

let tempDirectory: string | null = null;
let previousDatabaseUrl: string | undefined;

beforeEach(() => {
  vi.resetModules();
  generatedTitle.mockResolvedValue('Generated title');
  tempDirectory = mkdtempSync(path.join(tmpdir(), 'agents-chat-session-'));
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${path.join(tempDirectory, 'test.sqlite')}`;
});

afterEach(() => {
  if (previousDatabaseUrl == null) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = previousDatabaseUrl;
  }

  if (tempDirectory != null) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = null;
  }
});

async function loadModules(): Promise<{
  chatSession: ChatSessionModule;
  db: DbModule;
}> {
  const [chatSession, db] = await Promise.all([
    import('./chat-session'),
    import('@/lib/db'),
  ]);

  await db.getDb().$client.execute(`
    CREATE TABLE chat_sessions (
      id text PRIMARY KEY NOT NULL,
      agent_id text NOT NULL,
      title text,
      messages text NOT NULL,
      archived_at integer,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
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

  await input.db.$client.execute({
    sql: `
      INSERT INTO chat_sessions (
        id,
        agent_id,
        title,
        messages,
        archived_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      input.id,
      input.agentId ?? 'default',
      input.title ?? null,
      typeof input.messages === 'string'
        ? input.messages
        : JSON.stringify(input.messages),
      input.archivedAt?.getTime() ?? null,
      (input.createdAt ?? now).getTime(),
      (input.updatedAt ?? now).getTime(),
    ],
  });
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
