/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegisteredAgent } from '@/lib/agent-registry';

import { POST } from './route';
import { resolveRequestedAgent } from '@/lib/agent-registry';
import { createChatSession } from '@/lib/chat-session';

vi.mock('@/lib/agent-registry', () => ({
  resolveRequestedAgent: vi.fn(),
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

describe('POST /api/[agentId]/sessions', () => {
  beforeEach(() => {
    vi.mocked(resolveRequestedAgent).mockResolvedValue(resolvedAgent);
    vi.mocked(createChatSession).mockResolvedValue('session-1');
  });

  it('returns 400 for unknown agents', async () => {
    vi.mocked(resolveRequestedAgent).mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/missing/sessions'), {
      params: Promise.resolve({ agentId: 'missing' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Unknown agentId' });
    expect(createChatSession).not.toHaveBeenCalled();
  });

  it('creates a session for known agents', async () => {
    const response = await POST(new Request('http://localhost/api/default/sessions'), {
      params: Promise.resolve({ agentId: 'default' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      agentId: 'default',
      sessionId: 'session-1',
      chatPath: '/default/session-1',
      apiPath: '/api/default/session-1',
    });
    expect(resolveRequestedAgent).toHaveBeenCalledWith('default');
    expect(createChatSession).toHaveBeenCalledWith('default');
  });
});
