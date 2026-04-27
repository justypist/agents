/** @vitest-environment node */

import type { UIMessage } from 'ai';
import { validateUIMessages } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisteredAgent } from '@/lib/agent-registry';
import { resolveRequestedAgent } from '@/lib/agent-registry';
import {
  getChatSession,
  saveChatSessionMessages,
  updateChatSessionTurnState,
  type StoredChatSession,
} from '@/lib/chat-session';
import {
  completeChatSessionTurn,
  failChatSessionTurn,
  submitChatSessionTurn,
} from '@/lib/chat/chat-background-service';
import { generateAgentReplyMessages } from '@/lib/chat/chat-stream-service';

vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>();

  return {
    ...actual,
    validateUIMessages: vi.fn(),
  };
});

vi.mock('@/lib/agent-registry', () => ({
  resolveRequestedAgent: vi.fn(),
}));

vi.mock('@/lib/chat-session', () => ({
  getChatSession: vi.fn(),
  saveChatSessionMessages: vi.fn(),
  updateChatSessionTurnState: vi.fn(),
}));

vi.mock('@/lib/chat/chat-stream-service', () => ({
  generateAgentReplyMessages: vi.fn(),
}));

const userMessage = textMessage('message-1', 'hello', 'user');
const nextUserMessage = textMessage('message-2', 'next', 'user');
const assistantMessage = textMessage('message-3', 'hi', 'assistant');
const resolvedAgent: RegisteredAgent = {
  id: 'default',
  displayName: 'Agents',
  routeSegment: 'default',
  agent: {
    stream: async () => ({
      toUIMessageStream: () => new ReadableStream(),
      toUIMessageStreamResponse: () => new Response(null),
    }),
  },
};

describe('chat background service', () => {
  beforeEach(() => {
    vi.mocked(resolveRequestedAgent).mockResolvedValue(resolvedAgent);
    vi.mocked(validateUIMessages).mockResolvedValue([userMessage]);
    vi.mocked(saveChatSessionMessages).mockResolvedValue(undefined);
    vi.mocked(updateChatSessionTurnState).mockResolvedValue(undefined);
    vi.mocked(generateAgentReplyMessages).mockResolvedValue([
      userMessage,
      assistantMessage,
    ]);
  });

  it('persists a submitted user message and marks the turn running', async () => {
    const idleSession = sessionWith({ messages: [] });
    const runningSession = sessionWith({
      messages: [userMessage],
      status: 'running',
      currentUserMessageId: userMessage.id,
    });
    vi.mocked(getChatSession)
      .mockResolvedValueOnce(idleSession)
      .mockResolvedValueOnce(runningSession);

    await expect(
      submitChatSessionTurn({
        agentId: 'default',
        sessionId: 'session-1',
        requestSessionId: 'session-1',
        messages: [userMessage],
      }),
    ).resolves.toEqual({
      status: 'accepted',
      session: runningSession,
      userMessage,
    });

    expect(saveChatSessionMessages).toHaveBeenCalledWith({
      sessionId: 'session-1',
      messages: [userMessage],
      turnState: {
        status: 'running',
        currentUserMessageId: userMessage.id,
        errorSummary: null,
      },
    });
  });

  it('returns the existing session for duplicate submitted turns', async () => {
    const runningSession = sessionWith({
      messages: [userMessage],
      status: 'running',
      currentUserMessageId: userMessage.id,
    });
    vi.mocked(getChatSession).mockResolvedValue(runningSession);

    await expect(
      submitChatSessionTurn({
        agentId: 'default',
        sessionId: 'session-1',
        messages: [userMessage],
      }),
    ).resolves.toEqual({
      status: 'duplicate',
      session: runningSession,
    });

    expect(saveChatSessionMessages).not.toHaveBeenCalled();
  });

  it('rejects a different user message while a turn is running', async () => {
    const runningSession = sessionWith({
      messages: [userMessage],
      status: 'running',
      currentUserMessageId: userMessage.id,
    });
    vi.mocked(validateUIMessages).mockResolvedValue([nextUserMessage]);
    vi.mocked(getChatSession).mockResolvedValue(runningSession);

    await expect(
      submitChatSessionTurn({
        agentId: 'default',
        sessionId: 'session-1',
        messages: [nextUserMessage],
      }),
    ).resolves.toMatchObject({
      status: 'conflict',
      session: runningSession,
    });

    expect(saveChatSessionMessages).not.toHaveBeenCalled();
  });

  it('generates and saves completed assistant messages', async () => {
    const runningSession = sessionWith({
      messages: [userMessage],
      status: 'running',
      currentUserMessageId: userMessage.id,
    });
    const completedSession = sessionWith({
      messages: [userMessage, assistantMessage],
      status: 'completed',
      currentUserMessageId: userMessage.id,
    });
    vi.mocked(getChatSession)
      .mockResolvedValueOnce(runningSession)
      .mockResolvedValueOnce(completedSession);

    await expect(
      completeChatSessionTurn({
        agentId: 'default',
        sessionId: 'session-1',
        userMessageId: userMessage.id,
      }),
    ).resolves.toBe(completedSession);

    expect(generateAgentReplyMessages).toHaveBeenCalledWith({
      agent: resolvedAgent.agent,
      messages: [userMessage],
    });
    expect(saveChatSessionMessages).toHaveBeenCalledWith({
      sessionId: 'session-1',
      messages: [userMessage, assistantMessage],
      turnState: {
        status: 'completed',
        currentUserMessageId: userMessage.id,
        errorSummary: null,
      },
    });
  });

  it('records failed turn state without replacing messages', async () => {
    const runningSession = sessionWith({
      messages: [userMessage],
      status: 'running',
      currentUserMessageId: userMessage.id,
    });
    const failedSession = sessionWith({
      messages: [userMessage],
      status: 'failed',
      currentUserMessageId: userMessage.id,
      errorSummary: 'model unavailable',
    });
    vi.mocked(getChatSession)
      .mockResolvedValueOnce(runningSession)
      .mockResolvedValueOnce(failedSession);

    await expect(
      failChatSessionTurn({
        sessionId: 'session-1',
        userMessageId: userMessage.id,
        error: new Error('model unavailable'),
      }),
    ).resolves.toBe(failedSession);

    expect(updateChatSessionTurnState).toHaveBeenCalledWith({
      sessionId: 'session-1',
      turnState: {
        status: 'failed',
        currentUserMessageId: userMessage.id,
        errorSummary: 'model unavailable',
      },
    });
    expect(saveChatSessionMessages).not.toHaveBeenCalled();
  });
});

function textMessage(
  id: string,
  text: string,
  role: UIMessage['role'],
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
  };
}

function sessionWith(input: {
  messages: UIMessage[];
  status?: StoredChatSession['turnState']['status'];
  currentUserMessageId?: string | null;
  errorSummary?: string | null;
}): StoredChatSession {
  return {
    id: 'session-1',
    agentId: 'default',
    title: null,
    messages: input.messages,
    turnState: {
      status: input.status ?? 'idle',
      currentUserMessageId: input.currentUserMessageId ?? null,
      errorSummary: input.errorSummary ?? null,
      updatedAt: null,
    },
  };
}
