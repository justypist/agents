import { LoadingSpinner } from '@/components/ui/loading-spinner';

import { getPendingReplyLabel } from '../helpers';

type PendingReplyProps = {
  status: string;
};

export function PendingReply({ status }: PendingReplyProps) {
  return (
    <article className="border-b border-border pb-4">
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Agent
      </p>
      <div className="space-y-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <LoadingSpinner className="h-3 w-3" />
          处理中
        </div>
        <p>{getPendingReplyLabel(status)}</p>
      </div>
    </article>
  );
}
