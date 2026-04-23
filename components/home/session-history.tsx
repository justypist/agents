'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, useTransition } from 'react';

import type { HomeChatSessionItem } from '@/lib/chat-session';

const CHAT_SESSION_PAGE_SIZE = 10;

type SessionHistoryProps = {
  initialHasMore: boolean;
  initialItems: HomeChatSessionItem[];
};

type SessionListResponse = {
  items?: HomeChatSessionItem[];
  hasMore?: boolean;
};

export function SessionHistory({
  initialHasMore,
  initialItems,
}: SessionHistoryProps) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [showArchived, setShowArchived] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingSessionIds, setPendingSessionIds] = useState<string[]>([]);
  const [isPendingFilter, startFilterTransition] = useTransition();
  const pendingSessionIdSet = useMemo(
    () => new Set(pendingSessionIds),
    [pendingSessionIds],
  );

  const loadPage = useCallback(
    async (
      nextPage: number,
      nextShowArchived: boolean,
    ): Promise<SessionListResponse> => {
      const searchParams = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(CHAT_SESSION_PAGE_SIZE),
        includeArchived: nextShowArchived ? '1' : '0',
      });
      const response = await fetch(`/api/sessions?${searchParams.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      return (await response.json()) as SessionListResponse;
    },
    [],
  );

  const handleToggleArchivedVisibility = useCallback(async (): Promise<void> => {
    const nextShowArchived = !showArchived;

    try {
      const result = await loadPage(1, nextShowArchived);

      startFilterTransition(() => {
        setItems(Array.isArray(result.items) ? result.items : []);
        setHasMore(result.hasMore === true);
        setPage(1);
        setShowArchived(nextShowArchived);
      });
    } catch {
      window.alert('加载会话失败，请稍后重试。');
    }
  }, [loadPage, showArchived]);

  const handleLoadMore = useCallback(async (): Promise<void> => {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const nextPage = page + 1;
      const result = await loadPage(nextPage, showArchived);

      setItems(previousItems => [
        ...previousItems,
        ...(Array.isArray(result.items) ? result.items : []),
      ]);
      setHasMore(result.hasMore === true);
      setPage(nextPage);
    } catch {
      window.alert('加载更多会话失败，请稍后重试。');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadPage, loadingMore, page, showArchived]);

  const handleToggleArchive = useCallback(
    async (sessionId: string, archived: boolean): Promise<void> => {
      if (pendingSessionIdSet.has(sessionId)) {
        return;
      }

      setPendingSessionIds(previous => [...previous, sessionId]);

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ archived }),
        });

        if (!response.ok) {
          throw new Error('Failed to update session');
        }

        setItems(previousItems => {
          if (archived && !showArchived) {
            return previousItems.filter(item => item.id !== sessionId);
          }

          return previousItems.map(item =>
            item.id === sessionId
              ? {
                  ...item,
                  archivedAt: archived ? new Date().toISOString() : null,
                }
              : item,
          );
        });
      } catch {
        window.alert('更新会话状态失败，请稍后重试。');
      } finally {
        setPendingSessionIds(previous =>
          previous.filter(currentId => currentId !== sessionId),
        );
      }
    },
    [pendingSessionIdSet, showArchived],
  );

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Session History</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            历史会话
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleToggleArchivedVisibility();
          }}
          disabled={isPendingFilter}
          className="h-9 border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
        >
          {showArchived ? '隐藏归档' : '显示归档'}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-background">
        {items.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            {showArchived ? '暂无会话记录。' : '暂无未归档会话。'}
          </div>
        ) : (
          <div>
            {items.map(item => {
              const isArchived = item.archivedAt != null;
              const isUpdating = pendingSessionIdSet.has(item.id);

              return (
                <Link
                  key={item.id}
                  href={item.chatPath}
                  className="group flex items-center justify-between gap-4 border-b border-border px-5 py-3 transition-[background-color,border-color,color,transform,box-shadow] duration-150 last:border-b-0 hover:z-10 hover:translate-x-1 hover:border-border-strong hover:bg-[color-mix(in_srgb,var(--color-muted)_78%,var(--color-foreground)_22%)] hover:shadow-[inset_3px_0_0_0_var(--color-foreground),inset_0_0_0_1px_var(--color-border-strong)]"
                >
                  <div className="min-w-0 flex flex-1 items-center gap-4 overflow-hidden">
                    <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-foreground">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      {item.updatedAtLabel}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      {item.messageCount} 条消息
                    </span>
                    {isArchived ? (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        已归档
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleToggleArchive(item.id, !isArchived);
                    }}
                    disabled={isUpdating}
                    className="shrink-0 border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
                  >
                    {isUpdating
                      ? '处理中...'
                      : isArchived
                        ? '取消归档'
                        : '归档'}
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              void handleLoadMore();
            }}
            disabled={loadingMore || isPendingFilter}
            className="h-10 border border-border bg-background px-4 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
          >
            {loadingMore ? '加载中...' : '加载更多'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
