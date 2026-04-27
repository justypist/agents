/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisteredAgent } from '@/lib/agent-registry';

import AgentPage from './page';
import { getAgentByRouteSegment } from '@/lib/agent-registry';
import { createChatSession } from '@/lib/chat-session';
import { notFound, redirect } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/agent-registry', () => ({
  getAgentByRouteSegment: vi.fn(),
}));

vi.mock('@/lib/chat-session', () => ({
  createChatSession: vi.fn(),
}));

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

describe('Agent page', () => {
  beforeEach(() => {
    vi.mocked(getAgentByRouteSegment).mockResolvedValue(resolvedAgent);
    vi.mocked(createChatSession).mockResolvedValue('session-1');
  });

  it('returns not found for unknown agents', async () => {
    vi.mocked(getAgentByRouteSegment).mockResolvedValue(null);

    await expect(
      AgentPage({ params: Promise.resolve({ agent: 'missing' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    expect(createChatSession).not.toHaveBeenCalled();
  });

  it('creates a session and redirects for known agents', async () => {
    await expect(
      AgentPage({ params: Promise.resolve({ agent: 'default' }) }),
    ).rejects.toThrow('NEXT_REDIRECT:/default/session-1');
    expect(createChatSession).toHaveBeenCalledWith('default');
    expect(redirect).toHaveBeenCalledWith('/default/session-1');
  });
});
