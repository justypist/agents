import type { RefObject } from 'react';

type ChatComposerProps = {
  input: string;
  isLoading: boolean;
  hasError: boolean;
  canContinue: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
  onStop: () => void;
};

export function ChatComposer({
  input,
  isLoading,
  hasError,
  canContinue,
  inputRef,
  onInputChange,
  onSubmit,
  onContinue,
  onStop,
}: ChatComposerProps) {
  return (
    <>
      {hasError ? (
        <p className="mb-3 text-sm text-muted-foreground">出现错误，请稍后重试。</p>
      ) : null}

      <form
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="relative">
          <label className="block">
            <span className="sr-only">输入消息</span>
            <textarea
              ref={inputRef}
              className="min-h-24 w-full resize-none border border-border bg-background px-3 py-2 pb-14 pr-20 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
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
              className="absolute bottom-3 right-3 h-8 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted"
            >
              停止
            </button>
          ) : (
            <>
              {canContinue ? (
                <button
                  type="button"
                  onClick={onContinue}
                  className="absolute bottom-3 right-16 h-8 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  继续
                </button>
              ) : null}
              <button
                type="submit"
                disabled={input.trim().length === 0}
                className="absolute bottom-3 right-3 h-8 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
              >
                发送
              </button>
            </>
          )}
        </div>
      </form>
    </>
  );
}
