/** @vitest-environment node */

import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
import { streamChatSessionTurn } from '@/lib/chat/chat-stream-service';

vi.mock('@/lib/chat/chat-stream-service', () => ({
  streamChatSessionTurn: vi.fn(),
}));

const messages: UIMessage[] = [
  {
    id: 'message-1',
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
  },
];

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/default/session-1', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/[agentId]/[sessionId]', () => {
  beforeEach(() => {
    vi.mocked(streamChatSessionTurn).mockResolvedValue(new Response('ok', { status: 202 }));
  });

  it('returns 400 for invalid chat request bodies', async () => {
    const response = await POST(postJson({ id: 'session-1', messages: {} }), {
      params: Promise.resolve({ agentId: 'default', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid chat request' });
    expect(streamChatSessionTurn).not.toHaveBeenCalled();
  });

  it('passes valid chat requests to the stream service', async () => {
    const request = postJson({ id: 'session-1', messages });
    const response = await POST(request, {
      params: Promise.resolve({ agentId: 'default', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(202);
    expect(streamChatSessionTurn).toHaveBeenCalledWith({
      agentId: 'default',
      sessionId: 'session-1',
      requestSessionId: 'session-1',
      messages,
      abortSignal: request.signal,
    });
  });
});
