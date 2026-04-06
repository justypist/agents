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
        <p>{getPendingReplyLabel(status)}</p>
      </div>
    </article>
  );
}
