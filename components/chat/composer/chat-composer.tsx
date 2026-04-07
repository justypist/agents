import type { RefObject } from 'react';

type ChatComposerProps = {
  input: string;
  isLoading: boolean;
  hasError: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
};

export function ChatComposer({
  input,
  isLoading,
  hasError,
  inputRef,
  onInputChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  return (
    <>
      {hasError ? (
        <p className="mb-3 text-sm text-muted-foreground">出现错误，请稍后重试。</p>
      ) : null}

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex-1">
          <span className="sr-only">输入消息</span>
          <textarea
            ref={inputRef}
            className="min-h-24 w-full resize-none border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
            value={input}
            onChange={event => onInputChange(event.target.value)}
            onKeyDown={event => {
              if (
                event.key !== 'Enter' ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              ) {
                return;
              }

              event.preventDefault();
              onSubmit();
            }}
            placeholder="输入你的问题..."
            disabled={isLoading}
          />
        </label>

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="h-10 border border-border px-4 text-sm text-foreground"
          >
            停止
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="h-10 border border-border bg-background px-4 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          发送
        </button>
      </form>
    </>
  );
}
