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
import { getEnabledSkillByName } from '@/lib/skills';

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

vi.mock('@/lib/skills', () => ({
  getEnabledSkillByName: vi.fn(),
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
    vi.mocked(getEnabledSkillByName).mockResolvedValue(null);
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

  it('injects explicitly invoked enabled skills and strips the prefix for the model', async () => {
    const invokedMessages: UIMessage[] = [
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: '/research-plan 帮我整理信息' }],
      },
    ];
    vi.mocked(validateUIMessages).mockResolvedValue(invokedMessages);
    vi.mocked(getEnabledSkillByName).mockResolvedValue({
      id: 'skill-1',
      name: 'research-plan',
      displayName: 'Research Plan',
      description: 'Plan research tasks',
      content: 'Use structured research steps.',
      status: 'enabled',
      sourceSessionId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await streamChatSessionTurn({
      agentId: 'default',
      sessionId: 'session-1',
      messages: invokedMessages,
    });

    expect(response.status).toBe(202);
    expect(getEnabledSkillByName).toHaveBeenCalledWith('research-plan');
    expect(convertToModelMessages).toHaveBeenCalledWith([
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: '帮我整理信息' }],
      },
    ]);
    expect(agentStream).toHaveBeenCalledWith({
      messages: [
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('/research-plan'),
        }),
        ...modelMessages,
      ],
      abortSignal: undefined,
    });
  });

  it('rejects explicit calls for missing or disabled skills', async () => {
    const invokedMessages: UIMessage[] = [
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: '/research-plan 帮我整理信息' }],
      },
    ];
    vi.mocked(validateUIMessages).mockResolvedValue(invokedMessages);
    vi.mocked(getEnabledSkillByName).mockResolvedValue(null);

    const response = await streamChatSessionTurn({
      agentId: 'default',
      sessionId: 'session-1',
      messages: invokedMessages,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Skill "research-plan" is not available',
    });
    expect(agentStream).not.toHaveBeenCalled();
  });
});
