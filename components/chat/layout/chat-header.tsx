'use client';

import Link from 'next/link';

import { getStatusLabel } from '../helpers';

type ChatHeaderProps = {
  isCreatingSession?: boolean;
  onCreateSession?: () => void;
  status: string;
  title: string;
};

export function ChatHeader({
  isCreatingSession = false,
  onCreateSession,
  status,
  title,
}: ChatHeaderProps) {
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

          <h1 className="text-sm font-medium tracking-[-0.01em]">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{getStatusLabel(status)}</span>

          <button
            type="button"
            onClick={onCreateSession}
            disabled={isCreatingSession}
            className="h-8 border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
          >
            {isCreatingSession ? '创建中...' : '新建会话'}
          </button>
        </div>
      </div>
    </div>
  );
}
