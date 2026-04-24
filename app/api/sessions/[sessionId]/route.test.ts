/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from './route';
import {
  regenerateChatSessionTitle,
  setChatSessionArchived,
} from '@/lib/chat-session';

vi.mock('@/lib/chat-session', () => ({
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
