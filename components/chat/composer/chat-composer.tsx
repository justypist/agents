'use client';

import type { RefObject } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

type ComposerAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status:
    | 'hashing'
    | 'preparing'
    | 'uploading'
    | 'completing'
    | 'uploaded'
    | 'error';
  progress: number;
  errorText?: string;
};

type ChatComposerProps = {
  isLoading: boolean;
  isUploadingFiles: boolean;
  hasError: boolean;
  canContinue: boolean;
  canSubmit: boolean;
  attachments: ComposerAttachment[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onFilesSelect: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSubmit: (input: string) => void;
  onContinue: () => void;
  onStop: () => void;
};

const INPUT_HISTORY_STORAGE_KEY = 'agents:chat-input-history';
const MAX_INPUT_HISTORY = 128;

export function ChatComposer({
  isLoading,
  isUploadingFiles,
  hasError,
  canContinue,
  canSubmit,
  attachments,
  inputRef,
  onFilesSelect,
  onRemoveAttachment,
  onSubmit,
  onContinue,
  onStop,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const inputDraftRef = useRef('');
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>(() =>
    readStoredInputHistory(),
  );
  const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAttachmentListExpanded, setIsAttachmentListExpanded] = useState(false);
  const hasAttachmentError = attachments.some(
    attachment => attachment.status === 'error',
  );
  const hasUploadedAttachments = attachments.some(
    attachment => attachment.status === 'uploaded',
  );
  const canSubmitMessage =
    canSubmit && (input.trim().length > 0 || hasUploadedAttachments);
  const toggleAttachmentListExpanded = useCallback((): void => {
    setIsAttachmentListExpanded(expanded => !expanded);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        INPUT_HISTORY_STORAGE_KEY,
        JSON.stringify(inputHistory),
      );
    } catch {
      // Ignore storage failures so input remains usable in restricted environments.
    }
  }, [inputHistory]);

  const moveCaretToInputEnd = (): void => {
    requestAnimationFrame(() => {
      const textarea = inputRef.current;

      if (textarea == null) {
        return;
      }

      const end = textarea.value.length;
      textarea.focus();
      textarea.setSelectionRange(end, end);
    });
  };

  const submitInput = (): void => {
    if (!canSubmitMessage) {
      return;
    }

    const trimmedInput = input.trim();

    if (trimmedInput.length > 0) {
      setInputHistory(previous => appendInputHistory(previous, trimmedInput));
    }

    inputDraftRef.current = '';
    setInputHistoryIndex(null);
    onSubmit(trimmedInput);
    setInput('');
  };

  const handleInputChange = (value: string): void => {
    if (inputHistoryIndex != null) {
      inputDraftRef.current = value;
      setInputHistoryIndex(null);
    }

    setInput(value);
  };

  const handleHistoryNavigate = (direction: 'up' | 'down'): void => {
    if (inputHistory.length === 0) {
      return;
    }

    if (direction === 'up') {
      const nextIndex =
        inputHistoryIndex == null
          ? inputHistory.length - 1
          : Math.max(inputHistoryIndex - 1, 0);

      if (inputHistoryIndex == null) {
        inputDraftRef.current = input;
      }

      setInputHistoryIndex(nextIndex);
      setInput(inputHistory[nextIndex]);
      moveCaretToInputEnd();
      return;
    }

    if (inputHistoryIndex == null) {
      return;
    }

    if (inputHistoryIndex === inputHistory.length - 1) {
      setInputHistoryIndex(null);
      setInput(inputDraftRef.current);
      moveCaretToInputEnd();
      return;
    }

    const nextIndex = inputHistoryIndex + 1;
    setInputHistoryIndex(nextIndex);
    setInput(inputHistory[nextIndex]);
    moveCaretToInputEnd();
  };

  return (
    <>
      {hasError ? (
        <p className="mb-3 text-sm text-muted-foreground">出现错误，请稍后重试。</p>
      ) : null}

      {hasAttachmentError ? (
        <p className="mb-3 text-sm text-muted-foreground">
          有文件上传失败，请移除后重试。
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <AttachmentList
          attachments={attachments}
          isExpanded={isAttachmentListExpanded}
          onToggleExpanded={toggleAttachmentListExpanded}
          onRemoveAttachment={onRemoveAttachment}
        />
      ) : null}

      <form
        onSubmit={event => {
          event.preventDefault();
          submitInput();
        }}
      >
        <div
          className="relative"
          onDragEnter={event => {
            if (!hasFiles(event.dataTransfer)) {
              return;
            }

            event.preventDefault();
            dragDepthRef.current += 1;
            setIsDragActive(true);
          }}
          onDragOver={event => {
            if (!hasFiles(event.dataTransfer)) {
              return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsDragActive(true);
          }}
          onDragLeave={event => {
            if (!hasFiles(event.dataTransfer)) {
              return;
            }

            event.preventDefault();
            dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);

            if (dragDepthRef.current === 0) {
              setIsDragActive(false);
            }
          }}
          onDrop={event => {
            if (!hasFiles(event.dataTransfer)) {
              return;
            }

            event.preventDefault();
            dragDepthRef.current = 0;
            setIsDragActive(false);
            onFilesSelect(event.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={event => {
              onFilesSelect(event.target.files);
              event.currentTarget.value = '';
            }}
          />

          <label className="block">
            <span className="sr-only">输入消息</span>
            <textarea
              ref={inputRef}
              className="min-h-24 w-full resize-none border border-border bg-background px-3 py-2 pb-14 pr-20 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
              value={input}
              onChange={event => handleInputChange(event.target.value)}
              onPaste={event => {
                if (!hasFiles(event.clipboardData)) {
                  return;
                }

                event.preventDefault();
                onFilesSelect(event.clipboardData.files);
              }}
              onKeyDown={event => {
                if (
                  !event.nativeEvent.isComposing &&
                  !event.shiftKey &&
                  !event.altKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  shouldHandleHistoryNavigation(event.currentTarget, event.key)
                ) {
                  event.preventDefault();
                  handleHistoryNavigate(event.key === 'ArrowUp' ? 'up' : 'down');
                  return;
                }

                if (
                  event.key !== 'Enter' ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing
                ) {
                  return;
                }

                event.preventDefault();
                submitInput();
              }}
              placeholder="输入你的问题..."
            />
          </label>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-3 left-3 z-10 h-8 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted"
          >
            上传文件
          </button>

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border border-dashed border-border-strong bg-background/90 text-sm text-foreground">
              松开以上传文件
            </div>
          ) : null}

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
                disabled={!canSubmitMessage}
                className="absolute bottom-3 right-3 h-8 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
              >
                {isUploadingFiles ? '上传中' : '发送'}
              </button>
            </>
          )}
        </div>
      </form>
    </>
  );
}

const AttachmentList = memo(function AttachmentList({
  attachments,
  isExpanded,
  onToggleExpanded,
  onRemoveAttachment,
}: {
  attachments: ComposerAttachment[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
}) {
  const isAttachmentListCollapsible = attachments.length > 4;
  const attachmentSummary = summarizeAttachments(attachments);
  const shouldShowAttachmentList = attachments.length <= 6 || isExpanded;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">{attachmentSummary}</p>

        {isAttachmentListCollapsible ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {shouldShowAttachmentList ? '收起' : '展开'}
          </button>
        ) : null}
      </div>

      {shouldShowAttachmentList ? (
        <div className="max-h-56 overflow-y-auto border border-border bg-background">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatAttachmentStatus(attachment)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
                className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                移除
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

function shouldHandleHistoryNavigation(
  textarea: HTMLTextAreaElement,
  key: string,
): key is 'ArrowUp' | 'ArrowDown' {
  if (key !== 'ArrowUp' && key !== 'ArrowDown') {
    return false;
  }

  if (textarea.selectionStart !== textarea.selectionEnd) {
    return false;
  }

  const caret = textarea.selectionStart;

  if (key === 'ArrowUp') {
    return !textarea.value.slice(0, caret).includes('\n');
  }

  return !textarea.value.slice(caret).includes('\n');
}

function formatAttachmentStatus(attachment: ComposerAttachment): string {
  const sizeLabel = formatFileSize(attachment.size);

  switch (attachment.status) {
    case 'hashing':
      return `${sizeLabel} · 计算哈希中`;
    case 'preparing':
      return `${sizeLabel} · 申请上传地址中`;
    case 'uploading':
      return `${sizeLabel} · 上传中 ${Math.round(attachment.progress * 100)}%`;
    case 'completing':
      return `${sizeLabel} · 校验上传结果中`;
    case 'uploaded':
      return `${sizeLabel} · 已上传 · ${attachment.mimeType}`;
    case 'error':
      return `${sizeLabel} · ${attachment.errorText ?? '上传失败'}`;
    default:
      return sizeLabel;
  }
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function readStoredInputHistory(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(INPUT_HISTORY_STORAGE_KEY);

    if (stored == null) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .slice(-MAX_INPUT_HISTORY);
  } catch {
    return [];
  }
}

function appendInputHistory(history: string[], input: string): string[] {
  if (history[history.length - 1] === input) {
    return history;
  }

  return [...history, input].slice(-MAX_INPUT_HISTORY);
}

function summarizeAttachments(attachments: ComposerAttachment[]): string {
  const uploadedCount = attachments.filter(
    attachment => attachment.status === 'uploaded',
  ).length;
  const activeCount = attachments.filter(
    attachment =>
      attachment.status === 'hashing' ||
      attachment.status === 'preparing' ||
      attachment.status === 'uploading' ||
      attachment.status === 'completing',
  ).length;
  const errorCount = attachments.filter(
    attachment => attachment.status === 'error',
  ).length;
  const summaryParts = [`共 ${attachments.length} 个文件`];

  if (activeCount > 0) {
    summaryParts.push(`上传中 ${activeCount}`);
  }

  if (uploadedCount > 0) {
    summaryParts.push(`已完成 ${uploadedCount}`);
  }

  if (errorCount > 0) {
    summaryParts.push(`失败 ${errorCount}`);
  }

  return summaryParts.join(' · ');
}

function hasFiles(dataTransfer: DataTransfer | null): boolean {
  if (dataTransfer == null) {
    return false;
  }

  if (dataTransfer.files.length > 0) {
    return true;
  }

  return Array.from(dataTransfer.items).some(item => item.kind === 'file');
}
