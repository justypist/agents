'use client';

import { useRef, useState } from 'react';

type SkillEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

type SelectionRange = {
  start: number;
  end: number;
  text: string;
};

export function SkillEditor({ value, onChange, disabled = false }: SkillEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [prompt, setPrompt] = useState('');
  const [candidate, setCandidate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const captureSelection = (): void => {
    const textarea = textareaRef.current;

    if (textarea == null) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value.slice(start, end);

    setSelection(text.trim().length > 0 ? { start, end, text } : null);
  };

  const rewriteSelection = async (): Promise<void> => {
    if (selection == null || prompt.trim().length === 0) {
      setError('请选择正文片段并输入改写提示词');
      return;
    }

    setIsRewriting(true);
    setError(null);

    try {
      const response = await fetch('/api/skills/rewrite-selection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: value,
          selection: selection.text,
          prompt,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readError(payload, '改写选区失败'));
      }

      if (!isCandidatePayload(payload)) {
        throw new Error('改写响应格式无效');
      }

      setCandidate(payload.candidate);
    } catch (rewriteError) {
      setError(rewriteError instanceof Error ? rewriteError.message : '改写选区失败');
    } finally {
      setIsRewriting(false);
    }
  };

  const confirmCandidate = (): void => {
    if (selection == null) {
      return;
    }

    onChange(`${value.slice(0, selection.start)}${candidate}${value.slice(selection.end)}`);
    setSelection(null);
    setCandidate('');
    setPrompt('');
    setIsPanelOpen(false);
  };

  const cancelRewrite = (): void => {
    setCandidate('');
    setPrompt('');
    setError(null);
    setIsPanelOpen(false);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        className="min-h-[360px] w-full resize-y border border-border bg-background px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="写下这个 skill 的触发场景、执行步骤、约束和输出格式..."
      />

      {selection != null && !disabled ? (
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="absolute right-3 top-3 border border-border-strong bg-foreground px-3 py-1.5 text-xs text-background shadow-sm transition hover:opacity-85"
        >
          AI 改写选区
        </button>
      ) : null}

      {isPanelOpen ? (
        <div className="absolute inset-x-3 top-12 z-10 border border-border bg-background p-4 shadow-xl">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Selection Rewrite
              </p>
              <p className="mt-2 max-h-20 overflow-auto border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {selection?.text}
              </p>
            </div>
            <input
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
              placeholder="例如：更具体、改成检查清单、压缩到三条"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void rewriteSelection();
                }}
                disabled={isRewriting}
                className="border border-border-strong bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRewriting ? '生成中...' : candidate.length > 0 ? '重新生成' : '生成候选'}
              </button>
              <button
                type="button"
                onClick={cancelRewrite}
                className="border border-border px-3 py-2 text-sm transition hover:border-border-strong hover:bg-muted"
              >
                取消
              </button>
            </div>
            {error != null ? <p className="text-sm text-red-600">{error}</p> : null}
            {candidate.length > 0 ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={candidate}
                  onChange={event => setCandidate(event.target.value)}
                  className="min-h-32 border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition focus:border-border-strong"
                />
                <button
                  type="button"
                  onClick={confirmCandidate}
                  className="self-start border border-border-strong bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-85"
                >
                  确认回填
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isCandidatePayload(value: unknown): value is { candidate: string } {
  return (
    typeof value === 'object' &&
    value != null &&
    typeof (value as Record<string, unknown>).candidate === 'string'
  );
}

function readError(value: unknown, fallback: string): string {
  if (
    typeof value === 'object' &&
    value != null &&
    typeof (value as Record<string, unknown>).error === 'string'
  ) {
    return (value as { error: string }).error;
  }

  return fallback;
}
