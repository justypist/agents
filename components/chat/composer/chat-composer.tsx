'use client';

import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';

import type { ComposerAttachment } from '@/components/chat/attachments/types';
import { AttachmentList } from '@/components/chat/composer/attachment-list';
import {
  shouldHandleHistoryNavigation,
  useInputHistory,
} from '@/components/chat/composer/use-input-history';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAttachmentListExpanded, setIsAttachmentListExpanded] = useState(false);
  const {
    input,
    handleInputChange,
    handleHistoryNavigate,
    addSubmittedInput,
    clearInput,
  } = useInputHistory(inputRef);
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

  const submitInput = (): void => {
    if (!canSubmitMessage) {
      return;
    }

    const trimmedInput = input.trim();

    if (trimmedInput.length > 0) {
      addSubmittedInput(trimmedInput);
    }

    onSubmit(trimmedInput);
    clearInput();
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
                className="absolute bottom-3 right-3 inline-flex h-8 items-center gap-2 bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background"
              >
                {isUploadingFiles ? <LoadingSpinner className="h-3 w-3" /> : null}
                {isUploadingFiles ? '上传中' : '发送'}
              </button>
            </>
          )}
        </div>
      </form>
    </>
  );
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
