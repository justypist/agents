/** @vitest-environment node */

import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
import {
  completeChatSessionTurn,
  submitChatSessionTurn,
} from '@/lib/chat/chat-background-service';
import type { StoredChatSession } from '@/lib/chat-session';

vi.mock('@/lib/chat/chat-background-service', () => ({
  completeChatSessionTurn: vi.fn(),
  failChatSessionTurn: vi.fn(),
  submitChatSessionTurn: vi.fn(),
}));

const userMessage: UIMessage = {
  id: 'message-1',
  role: 'user',
  parts: [{ type: 'text', text: 'hello' }],
};
const messages: UIMessage[] = [userMessage];
const session: StoredChatSession = {
  id: 'session-1',
  agentId: 'default',
  title: null,
  messages,
  turnState: {
    status: 'running',
    currentUserMessageId: 'message-1',
    errorSummary: null,
    updatedAt: null,
  },
};

function postJson(body: unknown, signal?: AbortSignal): Request {
  return new Request('http://localhost/api/default/session-1', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  });
}

describe('POST /api/[agentId]/[sessionId]', () => {
  beforeEach(() => {
    vi.mocked(submitChatSessionTurn).mockResolvedValue({
      status: 'accepted',
      session,
      userMessage,
    });
    vi.mocked(completeChatSessionTurn).mockResolvedValue(session);
  });

  it('returns 400 for invalid chat request bodies', async () => {
    const response = await POST(postJson({ id: 'session-1', messages: {} }), {
      params: Promise.resolve({ agentId: 'default', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid chat request' });
    expect(submitChatSessionTurn).not.toHaveBeenCalled();
  });

  it('submits valid chat turns and returns a session snapshot', async () => {
    const request = postJson({ id: 'session-1', messages });
    const response = await POST(request, {
      params: Promise.resolve({ agentId: 'default', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ session });
    expect(submitChatSessionTurn).toHaveBeenCalledWith({
      agentId: 'default',
      sessionId: 'session-1',
      requestSessionId: 'session-1',
      messages,
    });
    expect(completeChatSessionTurn).toHaveBeenCalledWith({
      agentId: 'default',
      sessionId: 'session-1',
      userMessageId: 'message-1',
    });
  });

  it('starts background completion even if the request signal is aborted', async () => {
    const abortController = new AbortController();
    const request = postJson({ id: 'session-1', messages }, abortController.signal);
    abortController.abort();

    const response = await POST(request, {
      params: Promise.resolve({ agentId: 'default', sessionId: 'session-1' }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ session });
    expect(completeChatSessionTurn).toHaveBeenCalledWith({
      agentId: 'default',
      sessionId: 'session-1',
      userMessageId: 'message-1',
    });
  });
});
