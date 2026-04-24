/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HomeChatSessionListPage } from '@/lib/chat-session';

import { GET } from './route';
import { listHomeChatSessions } from '@/lib/chat-session';

vi.mock('@/lib/chat-session', () => ({
  CHAT_SESSION_PAGE_SIZE: 10,
  listHomeChatSessions: vi.fn(),
}));

const listResult: HomeChatSessionListPage = {
  items: [],
  hasMore: false,
};

describe('GET /api/sessions', () => {
  beforeEach(() => {
    vi.mocked(listHomeChatSessions).mockResolvedValue(listResult);
  });

  it('uses default pagination and archived filters', async () => {
    const response = await GET(new Request('http://localhost/api/sessions'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(listResult);
    expect(listHomeChatSessions).toHaveBeenCalledWith({
      includeArchived: false,
      page: 1,
      pageSize: 10,
    });
  });

  it('parses query parameters defensively', async () => {
    await GET(
      new Request(
        'http://localhost/api/sessions?includeArchived=1&page=3&pageSize=25',
      ),
    );
    await GET(
      new Request(
        'http://localhost/api/sessions?includeArchived=0&page=bad&pageSize=0',
      ),
    );

    expect(listHomeChatSessions).toHaveBeenNthCalledWith(1, {
      includeArchived: true,
      page: 3,
      pageSize: 25,
    });
    expect(listHomeChatSessions).toHaveBeenNthCalledWith(2, {
      includeArchived: false,
      page: 1,
      pageSize: 10,
    });
  });
});
