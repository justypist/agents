'use client';

import Link from 'next/link';

import { LoadingSpinner } from '@/components/ui/loading-spinner';

import { getStatusLabel } from '../helpers';

type ChatHeaderProps = {
  isCreatingSession?: boolean;
  isRegeneratingTitle?: boolean;
  onCreateSession?: () => void;
  onRegenerateTitle?: () => void;
  status: string;
  title: string;
};

export function ChatHeader({
  isCreatingSession = false,
  isRegeneratingTitle = false,
  onCreateSession,
  onRegenerateTitle,
  status,
  title,
}: ChatHeaderProps) {
  const isBusy =
    isCreatingSession ||
    isRegeneratingTitle ||
    status === 'submitted' ||
    status === 'streaming';

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="返回首页"
            className="flex h-8 w-8 items-center justify-center border border-border bg-background text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ←
          </Link>

          <div className="group/title flex items-center gap-2">
            <h1 className="text-sm font-medium tracking-[-0.01em]">{title}</h1>
            <button
              type="button"
              onClick={onRegenerateTitle}
              disabled={isRegeneratingTitle}
              aria-label="重新生成标题"
              title="重新生成标题"
              className="inline-flex h-6 items-center gap-1.5 border border-border px-2 text-xs text-muted-foreground opacity-0 transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 group-hover/title:opacity-100"
            >
              {isRegeneratingTitle ? <LoadingSpinner className="h-3 w-3" /> : null}
              {isRegeneratingTitle ? '生成中' : '重生成'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            {isBusy ? <LoadingSpinner className="h-3 w-3" /> : null}
            {getStatusLabel(status)}
          </span>

          <button
            type="button"
            onClick={onCreateSession}
            disabled={isCreatingSession}
            className="inline-flex h-8 items-center gap-2 border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
          >
            {isCreatingSession ? <LoadingSpinner className="h-3 w-3" /> : null}
            {isCreatingSession ? '创建中...' : '新建会话'}
          </button>
        </div>
      </div>
    </div>
  );
}
