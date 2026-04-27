/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET, PATCH } from './route';
import {
  getChatSession,
  regenerateChatSessionTitle,
  setChatSessionArchived,
  type StoredChatSession,
} from '@/lib/chat-session';

vi.mock('@/lib/chat-session', () => ({
  getChatSession: vi.fn(),
  regenerateChatSessionTitle: vi.fn(),
  setChatSessionArchived: vi.fn(),
}));

function patchJson(body: unknown): Request {
  return new Request('http://localhost/api/sessions/session-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

const context = {
  params: Promise.resolve({ sessionId: 'session-1' }),
};

const baseSession: StoredChatSession = {
  id: 'session-1',
  agentId: 'default',
  title: null,
  messages: [
    {
      id: 'message-1',
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
    },
  ],
  turnState: {
    status: 'idle',
    currentUserMessageId: null,
    errorSummary: null,
    updatedAt: null,
  },
};

describe('GET /api/sessions/[sessionId]', () => {
  it.each([
    ['running', 'message-1', null],
    ['completed', 'message-1', null],
    ['failed', 'message-1', 'model unavailable'],
  ] as const)('returns %s session snapshots', async (
    status,
    currentUserMessageId,
    errorSummary,
  ) => {
    const session: StoredChatSession = {
      ...baseSession,
      turnState: {
        status,
        currentUserMessageId,
        errorSummary,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    vi.mocked(getChatSession).mockResolvedValue(session);

    const response = await GET(new Request('http://localhost/api/sessions/session-1'), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ session });
  });

  it('returns 404 for missing sessions', async () => {
    vi.mocked(getChatSession).mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/sessions/missing'), context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Unknown sessionId' });
  });
});

describe('PATCH /api/sessions/[sessionId]', () => {
  beforeEach(() => {
    vi.mocked(regenerateChatSessionTitle).mockResolvedValue('New title');
    vi.mocked(setChatSessionArchived).mockResolvedValue(true);
  });

  it('regenerates titles', async () => {
    const response = await PATCH(patchJson({ regenerateTitle: true }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: 'session-1',
      title: 'New title',
    });
    expect(regenerateChatSessionTitle).toHaveBeenCalledWith({ sessionId: 'session-1' });
  });

  it('handles title regeneration failures', async () => {
    vi.mocked(regenerateChatSessionTitle).mockResolvedValueOnce(undefined);
    vi.mocked(regenerateChatSessionTitle).mockResolvedValueOnce(null);

    const missingResponse = await PATCH(patchJson({ regenerateTitle: true }), context);
    const failedResponse = await PATCH(patchJson({ regenerateTitle: true }), context);

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Unknown sessionId' });
    expect(failedResponse.status).toBe(400);
    await expect(failedResponse.json()).resolves.toEqual({ error: 'Failed to generate title' });
  });

  it('updates archive state', async () => {
    const response = await PATCH(patchJson({ archived: true }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: 'session-1',
      archived: true,
    });
    expect(setChatSessionArchived).toHaveBeenCalledWith({
      sessionId: 'session-1',
      archived: true,
    });
  });

  it('rejects invalid archive payloads and missing sessions', async () => {
    const invalidResponse = await PATCH(patchJson({ archived: 'yes' }), context);
    vi.mocked(setChatSessionArchived).mockResolvedValue(false);
    const missingResponse = await PATCH(patchJson({ archived: false }), context);

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid archived value' });
    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Unknown sessionId' });
  });
});
