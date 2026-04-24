import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisteredAgent } from '@/lib/agent-registry';
import type { HomeChatSessionItem } from '@/lib/chat-session';

import Home from './page';
import { getRouteAgents } from '@/lib/agent-registry';
import { listHomeChatSessions } from '@/lib/chat-session';

vi.mock('@/lib/agent-registry', () => ({
  getRouteAgents: vi.fn(),
}));

vi.mock('@/lib/chat-session', () => ({
  listHomeChatSessions: vi.fn(),
}));

vi.mock('@/components/home/agent-link-card', () => ({
  AgentLinkCard: (props: {
    displayName: string;
    href: string;
    routeSegment: string;
  }) => (
    <a href={props.href} data-testid="agent-card">
      {props.displayName} /{props.routeSegment}
    </a>
  ),
}));

vi.mock('@/components/home/session-history', () => ({
  SessionHistory: (props: {
    initialItems: HomeChatSessionItem[];
    initialHasMore: boolean;
  }) => (
    <section data-testid="session-history">
      {props.initialItems.map(item => item.title).join(',')}
      {props.initialHasMore ? ' has-more' : ' no-more'}
    </section>
  ),
}));

const agents: RegisteredAgent[] = [
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
    id: 'competitive-intelligence',
    displayName: 'Competitive Intelligence',
    routeSegment: 'competitive-intelligence',
    agent: {
      stream: async () => ({
        toUIMessageStreamResponse: () => new Response(null),
      }),
    },
  },
];

const sessions: HomeChatSessionItem[] = [
  {
    id: 'session-1',
    agentId: 'default',
    title: 'First session',
    previewText: 'Preview',
    messageCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    updatedAtLabel: '2026/01/01 00:00',
    archivedAt: null,
    agentDisplayName: 'Agents',
    chatPath: '/default/session-1',
  },
];

describe('Home page', () => {
  beforeEach(() => {
    vi.mocked(getRouteAgents).mockResolvedValue(agents);
    vi.mocked(listHomeChatSessions).mockResolvedValue({
      items: sessions,
      hasMore: true,
    });
  });

  it('renders registered agents and session history', async () => {
    render(await Home());

    expect(screen.getByRole('heading', { name: '选择一个 Agent' })).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-card')).toHaveLength(2);
    expect(screen.getByText('Agents /default')).toBeInTheDocument();
    expect(
      screen.getByText('Competitive Intelligence /competitive-intelligence'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('session-history')).toHaveTextContent(
      'First session has-more',
    );
    expect(listHomeChatSessions).toHaveBeenCalledWith({ page: 1 });
  });
});
