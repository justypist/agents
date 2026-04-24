/** @vitest-environment node */

import type { ModelMessage, UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisteredAgent } from '@/lib/agent-registry';
import type { StoredChatSession } from '@/lib/chat-session';

import { streamChatSessionTurn } from './chat-stream-service';
import {
  consumeStream,
  convertToModelMessages,
  validateUIMessages,
} from 'ai';
import { resolveRequestedAgent } from '@/lib/agent-registry';
import { getChatSession, saveChatSessionMessages } from '@/lib/chat-session';

vi.mock('ai', () => ({
  consumeStream: vi.fn(),
  convertToModelMessages: vi.fn(),
  createIdGenerator: vi.fn(() => () => 'msg-test'),
  validateUIMessages: vi.fn(),
}));

vi.mock('@/lib/agent-registry', () => ({
  resolveRequestedAgent: vi.fn(),
}));

vi.mock('@/lib/chat-session', () => ({
  getChatSession: vi.fn(),
  saveChatSessionMessages: vi.fn(),
}));

const messages: UIMessage[] = [
  {
    id: 'message-1',
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
  },
];

const modelMessages: ModelMessage[] = [
  {
    role: 'user',
    content: [{ type: 'text', text: 'hello' }],
  },
];

const session: StoredChatSession = {
  id: 'session-1',
  agentId: 'default',
  title: null,
  messages: [],
};

const toUIMessageStreamResponse = vi.fn(
  (options?: { onFinish?: (event: { messages: UIMessage[] }) => Promise<void> }) => {
    if (options?.onFinish != null) {
      void options.onFinish({ messages });
    }

    return new Response('stream', { status: 202 });
  },
);
const agentStream = vi.fn(async () => ({ toUIMessageStreamResponse }));
const resolvedAgent: RegisteredAgent = {
  id: 'default',
  displayName: 'Agents',
  routeSegment: 'default',
  agent: {
    stream: agentStream,
  },
};

describe('streamChatSessionTurn', () => {
  beforeEach(() => {
    vi.mocked(resolveRequestedAgent).mockResolvedValue(resolvedAgent);
    vi.mocked(getChatSession).mockResolvedValue(session);
    vi.mocked(validateUIMessages).mockResolvedValue(messages);
    vi.mocked(convertToModelMessages).mockResolvedValue(modelMessages);
    vi.mocked(saveChatSessionMessages).mockResolvedValue(undefined);
    toUIMessageStreamResponse.mockClear();
    agentStream.mockClear();
  });

  it('rejects unknown agents', async () => {
    vi.mocked(resolveRequestedAgent).mockResolvedValue(null);

    const response = await streamChatSessionTurn({
      agentId: 'missing',
      sessionId: 'session-1',
      messages,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Unknown agentId' });
  });

  it('rejects mismatched request session ids', async () => {
    const response = await streamChatSessionTurn({
      agentId: 'default',
      sessionId: 'session-1',
      requestSessionId: 'other-session',
      messages,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Mismatched sessionId' });
    expect(getChatSession).not.toHaveBeenCalled();
  });

  it('rejects unknown sessions', async () => {
    vi.mocked(getChatSession).mockResolvedValue(null);

    const response = await streamChatSessionTurn({
      agentId: 'default',
      sessionId: 'missing',
      messages,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Unknown sessionId' });
  });

  it('rejects sessions that belong to a different agent', async () => {
    vi.mocked(getChatSession).mockResolvedValue({ ...session, agentId: 'other' });

    const response = await streamChatSessionTurn({
      agentId: 'default',
      sessionId: 'session-1',
      messages,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Session does not belong to agentId',
    });
  });

  it('validates, streams, and saves finished messages', async () => {
    const abortController = new AbortController();
    const response = await streamChatSessionTurn({
      agentId: 'default',
      sessionId: 'session-1',
      requestSessionId: 'session-1',
      messages,
      abortSignal: abortController.signal,
    });

    expect(response.status).toBe(202);
    expect(validateUIMessages).toHaveBeenCalledWith({ messages });
    expect(convertToModelMessages).toHaveBeenCalledWith(messages);
    expect(agentStream).toHaveBeenCalledWith({
      messages: modelMessages,
      abortSignal: abortController.signal,
    });
    expect(toUIMessageStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        originalMessages: messages,
        generateMessageId: expect.any(Function),
        sendReasoning: true,
        consumeSseStream: consumeStream,
      }),
    );
    expect(saveChatSessionMessages).toHaveBeenCalledWith({
      sessionId: 'session-1',
      messages,
    });
  });
});
