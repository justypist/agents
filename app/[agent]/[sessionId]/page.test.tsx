import type { UIMessage } from 'ai';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisteredAgent } from '@/lib/agent-registry';
import type { StoredChatSession } from '@/lib/chat-session';

import ChatSessionPage from './page';
import { getAgentByRouteSegment } from '@/lib/agent-registry';
import { getChatSession } from '@/lib/chat-session';
import { listSkills } from '@/lib/skills';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/agent-registry', () => ({
  getAgentByRouteSegment: vi.fn(),
}));

vi.mock('@/lib/chat-session', () => ({
  getChatSession: vi.fn(),
}));

vi.mock('@/lib/skills', () => ({
  listSkills: vi.fn(),
}));

vi.mock('@/components/chat/chat-page', () => ({
  ChatPage: (props: {
    agentId: string;
    sessionId: string;
    initialMessages: UIMessage[];
    initialTitle: string | null;
    fallbackTitle: string;
    initialSkills: unknown[];
  }) => (
    <main data-testid="chat-page">
      {props.agentId} {props.sessionId} {props.initialTitle ?? props.fallbackTitle}{' '}
      {props.initialMessages.length}
    </main>
  ),
}));

const resolvedAgent: RegisteredAgent = {
  id: 'default',
  displayName: 'Agents',
  routeSegment: 'default',
  agent: {
    stream: async () => ({
      toUIMessageStreamResponse: () => new Response(null),
    }),
  },
};

const session: StoredChatSession = {
  id: 'session-1',
  agentId: 'default',
  title: 'Existing title',
  messages: [
    {
      id: 'message-1',
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
    },
  ],
};

describe('Chat session page', () => {
  beforeEach(() => {
    vi.mocked(getAgentByRouteSegment).mockResolvedValue(resolvedAgent);
    vi.mocked(getChatSession).mockResolvedValue(session);
    vi.mocked(listSkills).mockResolvedValue([]);
  });

  it('returns not found for unknown agents', async () => {
    vi.mocked(getAgentByRouteSegment).mockResolvedValue(null);

    await expect(
      ChatSessionPage({
        params: Promise.resolve({ agent: 'missing', sessionId: 'session-1' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(getChatSession).not.toHaveBeenCalled();
  });

  it('returns not found for unknown or mismatched sessions', async () => {
    vi.mocked(getChatSession).mockResolvedValueOnce(null);

    await expect(
      ChatSessionPage({
        params: Promise.resolve({ agent: 'default', sessionId: 'missing' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    vi.mocked(getChatSession).mockResolvedValueOnce({
      ...session,
      agentId: 'other-agent',
    });

    await expect(
      ChatSessionPage({
        params: Promise.resolve({ agent: 'default', sessionId: 'session-1' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders ChatPage with session data', async () => {
    render(
      await ChatSessionPage({
        params: Promise.resolve({ agent: 'default', sessionId: 'session-1' }),
      }),
    );

    expect(screen.getByTestId('chat-page')).toHaveTextContent(
      'default session-1 Existing title 1',
    );
  });
});
