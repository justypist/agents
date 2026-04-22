import { memo, useEffect, useState } from 'react';

import {
  formatDuration,
  getToolDetailLines,
  getToolLiveLines,
  getToolStateMeta,
  isToolActive,
} from '../../helpers';
import type { ToolState, ToolTiming } from '../../types';

type ToolPartProps = {
  toolCallId: string;
  toolName: string;
  state: ToolState;
  preliminary?: boolean;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  timing?: ToolTiming;
  expanded: boolean;
  onToggle: () => void;
};

export const ToolPart = memo(function ToolPart({
  toolCallId,
  toolName,
  state,
  preliminary,
  input,
  output,
  errorText,
  timing,
  expanded,
  onToggle,
}: ToolPartProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const stateMeta = getToolStateMeta(state, preliminary);
  const active = isToolActive(state, preliminary);
  const allLines = getToolDetailLines({
    state,
    input,
    output,
    errorText,
    preliminary,
  });
  const detailLines = active
    ? getToolLiveLines({
        state,
        input,
        output,
        errorText,
        preliminary,
      })
    : allLines;
  const durationMs =
    timing == null
      ? undefined
      : (timing.finishedAt ?? now) - timing.startedAt;

  useEffect(() => {
    if (!active || timing?.finishedAt != null) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      setNow(Date.now());
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [active, timing?.finishedAt, timing?.startedAt]);

  return (
    <section key={toolCallId} className="space-y-1 py-0.5 font-mono text-[13px] leading-6">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'tool-call-line',
          'w-full cursor-pointer text-left',
          active ? 'tool-call-line-running' : '',
          !active ? 'text-muted-foreground' : 'text-foreground',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="mr-2 text-muted-foreground">{expanded ? '[-]' : '[+]'}</span>
        <span className="mr-2 text-muted-foreground">tool</span>
        <span className={active ? 'tool-call-text-running' : 'mr-2'}>
          <span className="mr-2">{toolName}</span>
          <span className="mr-2 text-muted-foreground">·</span>
          <span className="mr-2">{stateMeta.label}</span>
        </span>
        {durationMs != null ? (
          <>
            <span className="mr-2 text-muted-foreground">·</span>
            <span>{formatDuration(durationMs)}</span>
          </>
        ) : null}
      </button>

      {expanded && detailLines.length > 0 ? (
        <pre className="tool-call-log whitespace-pre-wrap break-words text-muted-foreground">
          {detailLines.join('\n')}
        </pre>
      ) : null}
    </section>
  );
});
