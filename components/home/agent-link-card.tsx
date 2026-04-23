'use client';

import Link, { useLinkStatus } from 'next/link';

import { LoadingSpinner } from '@/components/ui/loading-spinner';

type AgentLinkCardProps = {
  displayName: string;
  href: string;
  routeSegment: string;
};

export function AgentLinkCard({
  displayName,
  href,
  routeSegment,
}: AgentLinkCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-background p-5 transition hover:border-border-strong hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">{displayName}</h2>
          <p className="mt-2 text-sm text-muted-foreground">路径：/{routeSegment}</p>
        </div>
        <AgentLinkStatus />
      </div>
    </Link>
  );
}

function AgentLinkStatus() {
  const { pending } = useLinkStatus();

  return (
    <span className="inline-flex min-w-[88px] items-center justify-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition group-hover:border-border-strong group-hover:text-foreground">
      {pending ? <LoadingSpinner className="h-3 w-3" /> : null}
      {pending ? '打开中...' : '打开'}
    </span>
  );
}
