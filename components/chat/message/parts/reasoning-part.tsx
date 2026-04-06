import {
  getLatestReasoningLines,
  getReasoningSummary,
  getReasoningText,
} from '../../helpers';

type ReasoningPartProps = {
  text: string;
  state?: 'streaming' | 'done';
  expanded: boolean;
  onToggle: () => void;
};

export function ReasoningPart({
  text,
  state,
  expanded,
  onToggle,
}: ReasoningPartProps) {
  const reasoningText = getReasoningText(text);
  const isStreaming = state === 'streaming';
  const detailLines = isStreaming
    ? getLatestReasoningLines(reasoningText)
    : reasoningText.length > 0
      ? reasoningText.split('\n').map(line => line.trimEnd()).filter(Boolean)
      : [];
  const summary = getReasoningSummary(reasoningText);

  return (
    <section className="space-y-1 py-0.5 font-mono text-[13px] leading-6">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'tool-call-line',
          'w-full cursor-pointer text-left',
          isStreaming ? 'tool-call-line-running text-foreground' : 'text-muted-foreground',
        ].join(' ')}
      >
        <span className="mr-2 text-muted-foreground">{expanded ? '[-]' : '[+]'}</span>
        <span className="mr-2 text-muted-foreground">reasoning</span>
        <span className={isStreaming ? 'tool-call-text-running' : undefined}>
          {isStreaming ? '思考中' : summary}
        </span>
      </button>

      {expanded && detailLines.length > 0 ? (
        <pre className="tool-call-log whitespace-pre-wrap break-words text-muted-foreground">
          {detailLines.join('\n')}
        </pre>
      ) : null}
    </section>
  );
}
