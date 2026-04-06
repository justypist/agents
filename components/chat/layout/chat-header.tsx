import { getStatusLabel } from '../helpers';

type ChatHeaderProps = {
  status: string;
};

export function ChatHeader({ status }: ChatHeaderProps) {
  return (
    <div className="border-b border-border px-4 py-3">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <h1 className="text-sm font-medium tracking-[-0.01em]">聊天</h1>
        <span className="text-sm text-muted-foreground">{getStatusLabel(status)}</span>
      </div>
    </div>
  );
}
