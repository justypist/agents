'use client';

import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  isToolUIPart,
  type FileUIPart,
  type UIMessage,
} from 'ai';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ChatComposer } from '@/components/chat/composer/chat-composer';
import { isToolActive, isToolFinished } from '@/components/chat/helpers';
import { ChatHeader } from '@/components/chat/layout/chat-header';
import { ChatMessageList } from '@/components/chat/message/chat-message-list';
import type { ExpandedStateMap, ToolTimingMap } from '@/components/chat/types';
import { UploadCanceledError, uploadFileToOss } from '@/lib/upload-client';
import type { UploadedFileAsset } from '@/lib/upload-types';

type ChatPageProps = {
  agentId: string;
  sessionId: string;
  initialMessages: UIMessage[];
  agentTitle: string;
};

const AUTO_SCROLL_ENTER_THRESHOLD = 24;
const AUTO_SCROLL_EXIT_THRESHOLD = 80;

type AttachmentStatus =
  | 'hashing'
  | 'preparing'
  | 'uploading'
  | 'completing'
  | 'uploaded'
  | 'error';

type PendingAttachment = {
  id: string;
  file: File;
  status: AttachmentStatus;
  progress: number;
  errorText?: string;
  hash?: string;
  asset?: UploadedFileAsset;
};

export function ChatPage({
  agentId,
  sessionId,
  initialMessages,
  agentTitle,
}: ChatPageProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContentRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const documentVisibleRef = useRef(true);
  const canceledUploadIdsRef = useRef<Set<string>>(new Set());
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [toolTimings, setToolTimings] = useState<ToolTimingMap>({});
  const [expandedStates, setExpandedStates] = useState<ExpandedStateMap>({});
  const [canContinue, setCanContinue] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const stopRequestedRef = useRef(false);
  const { messages, sendMessage, setMessages, status, stop, error, clearError } =
    useChat({
      id: sessionId,
      messages: initialMessages,
      experimental_throttle: 50,
      transport: new DefaultChatTransport({
        api: `/api/${agentId}/${sessionId}`,
      }),
    });
  const previousStatusRef = useRef(status);

  const isLoading = status === 'submitted' || status === 'streaming';
  const canContinueResponse = canContinue || error != null;
  const isUploadingFiles = attachments.some(
    attachment =>
      attachment.status === 'hashing' ||
      attachment.status === 'preparing' ||
      attachment.status === 'uploading' ||
      attachment.status === 'completing',
  );
  const hasAttachmentErrors = attachments.some(
    attachment => attachment.status === 'error',
  );
  const uploadedAttachments = useMemo(
    () =>
      attachments.filter(
        (attachment): attachment is PendingAttachment & { asset: UploadedFileAsset } =>
          attachment.status === 'uploaded' && attachment.asset != null,
      ),
    [attachments],
  );
  const canSubmitMessage = !isLoading && !isUploadingFiles && !hasAttachmentErrors;
  const composerAttachments = useMemo(
    () =>
      attachments.map(attachment => ({
        id: attachment.id,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.asset?.mimeType ?? normalizeMimeType(attachment.file.type),
        status: attachment.status,
        progress: attachment.progress,
        errorText: attachment.errorText,
      })),
    [attachments],
  );
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        message => !(message.role === 'assistant' && message.parts.length === 0),
      ),
    [messages],
  );
  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const shouldShowPendingReply =
    isLoading &&
    (lastMessage == null || lastMessage.role !== 'assistant');

  const updateAutoScrollState = (): void => {
    const container = messagesContainerRef.current;

    if (container == null) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (shouldAutoScrollRef.current) {
      shouldAutoScrollRef.current =
        distanceFromBottom <= AUTO_SCROLL_EXIT_THRESHOLD;
      return;
    }

    shouldAutoScrollRef.current =
      distanceFromBottom <= AUTO_SCROLL_ENTER_THRESHOLD;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'auto'): void => {
    const container = messagesContainerRef.current;

    if (container == null) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    shouldAutoScrollRef.current = true;
  };

  const submitMessage = (input: string): void => {
    if (!canSubmitMessage) {
      return;
    }

    const trimmedInput = input.trim();
    const files: FileUIPart[] = uploadedAttachments.map(attachment => ({
      type: 'file',
      url: attachment.asset.url,
      mediaType: attachment.asset.mimeType,
      filename: attachment.file.name,
    }));

    setCanContinue(false);
    scrollToBottom('smooth');
    void sendMessage(
      files.length > 0 && trimmedInput.length > 0
        ? { text: trimmedInput, files }
          : files.length > 0
            ? { files }
            : { text: trimmedInput },
    );
    canceledUploadIdsRef.current.clear();
    setAttachments([]);
  };

  const updateAttachment = useCallback(
    (
      attachmentId: string,
      updater: (attachment: PendingAttachment) => PendingAttachment,
    ): void => {
      setAttachments(previousAttachments =>
        previousAttachments.map(attachment =>
          attachment.id === attachmentId ? updater(attachment) : attachment,
        ),
      );
    },
    [],
  );

  const uploadAttachment = useCallback(
    (attachmentId: string, file: File): void => {
      void (async () => {
        try {
          const result = await uploadFileToOss(file, {
            isCanceled: () => canceledUploadIdsRef.current.has(attachmentId),
            onStateChange: state => {
              updateAttachment(attachmentId, attachment => ({
                ...attachment,
                status: state,
                errorText: undefined,
              }));
            },
            onHashProgress: progress => {
              updateAttachment(attachmentId, attachment => ({
                ...attachment,
                status: 'hashing',
                progress,
              }));
            },
            onUploadProgress: progress => {
              updateAttachment(attachmentId, attachment => ({
                ...attachment,
                status: 'uploading',
                progress,
              }));
            },
          });

          if (canceledUploadIdsRef.current.has(attachmentId)) {
            return;
          }

          updateAttachment(attachmentId, attachment => ({
            ...attachment,
            status: 'uploaded',
            progress: 1,
            hash: result.hash,
            asset: result.asset,
            errorText: undefined,
          }));
        } catch (error) {
          if (
            error instanceof UploadCanceledError ||
            canceledUploadIdsRef.current.has(attachmentId)
          ) {
            return;
          }

          updateAttachment(attachmentId, attachment => ({
            ...attachment,
            status: 'error',
            errorText: toUploadErrorMessage(error),
          }));
        }
      })();
    },
    [updateAttachment],
  );

  const handleFilesSelect = useCallback(
    (fileList: FileList | null): void => {
      if (fileList == null || fileList.length === 0) {
        return;
      }

      const nextFiles = Array.from(fileList);
      const newAttachments = nextFiles
        .filter(
          file =>
            !attachments.some(attachment => isSameLocalFile(attachment.file, file)),
        )
        .reduce<PendingAttachment[]>((result, file) => {
          if (result.some(attachment => isSameLocalFile(attachment.file, file))) {
            return result;
          }

          result.push({
            id: crypto.randomUUID(),
            file,
            status: 'hashing',
            progress: 0,
          });

          return result;
        }, []);

      if (newAttachments.length === 0) {
        return;
      }

      for (const attachment of newAttachments) {
        canceledUploadIdsRef.current.delete(attachment.id);
      }

      setAttachments(previousAttachments => [...previousAttachments, ...newAttachments]);

      for (const attachment of newAttachments) {
        uploadAttachment(attachment.id, attachment.file);
      }
    },
    [attachments, uploadAttachment],
  );

  const handleRemoveAttachment = useCallback((attachmentId: string): void => {
    canceledUploadIdsRef.current.add(attachmentId);
    setAttachments(previousAttachments =>
      previousAttachments.filter(attachment => attachment.id !== attachmentId),
    );
  }, []);

  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current || !documentVisibleRef.current) {
      return;
    }

    scrollToBottom();
  }, [messages, status]);

  useEffect(() => {
    const content = messagesContentRef.current;

    if (content == null) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!shouldAutoScrollRef.current || !documentVisibleRef.current) {
        return;
      }

      scrollToBottom();
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    documentVisibleRef.current = document.visibilityState === 'visible';

    const handleVisibilityChange = (): void => {
      documentVisibleRef.current = document.visibilityState === 'visible';

      if (documentVisibleRef.current && shouldAutoScrollRef.current) {
        scrollToBottom();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom('smooth');
    });
  }, []);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (
      status === 'ready' &&
      (previousStatus === 'submitted' || previousStatus === 'streaming')
    ) {
      inputRef.current?.focus();
    }

    previousStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (isLoading || !stopRequestedRef.current) {
      return;
    }

    stopRequestedRef.current = false;
    setMessages(previousMessages =>
      normalizeInterruptedMessages(previousMessages, '已停止'),
    );
  }, [isLoading, setMessages]);

  useEffect(() => {
    if (isLoading || error == null) {
      return;
    }

    setMessages(previousMessages =>
      normalizeInterruptedMessages(previousMessages, '请求中断'),
    );
  }, [error, isLoading, setMessages]);

  useEffect(() => {
    const currentTime = Date.now();
    queueMicrotask(() => {
      setToolTimings(previous => {
        let changed = false;
        const next: ToolTimingMap = { ...previous };

        for (const message of messages) {
          for (const part of message.parts) {
            if (!isToolUIPart(part)) {
              continue;
            }

            const active = isToolActive(
              part.state,
              'preliminary' in part ? part.preliminary : undefined,
            );
            const finished = isToolFinished(
              part.state,
              'preliminary' in part ? part.preliminary : undefined,
            );
            const existingTiming = next[part.toolCallId];

            if (existingTiming == null) {
              next[part.toolCallId] = {
                startedAt: currentTime,
                finishedAt: finished ? currentTime : undefined,
              };
              changed = true;
              continue;
            }

            if (active && existingTiming.finishedAt != null) {
              next[part.toolCallId] = {
                startedAt: existingTiming.startedAt,
              };
              changed = true;
              continue;
            }

            if (finished && existingTiming.finishedAt == null) {
              next[part.toolCallId] = {
                startedAt: existingTiming.startedAt,
                finishedAt: currentTime,
              };
              changed = true;
            }
          }
        }

        return changed ? next : previous;
      });
    });
  }, [messages]);

  const handleStop = (): void => {
    setCanContinue(true);
    stopRequestedRef.current = true;
    void stop();
  };

  const handleContinue = (): void => {
    if (isLoading || messages.length === 0) {
      return;
    }

    setCanContinue(false);
    clearError();
    void sendMessage({
      text: '请从上一条助手回复中断的位置继续，不要重复已经完成的内容。只补全后续内容。',
    });
  };

  const toggleExpanded = useCallback((key: string, currentExpanded: boolean): void => {
    setExpandedStates(previous => ({
      ...previous,
      [key]: !currentExpanded,
    }));
  }, []);

  const handleCreateSession = async (): Promise<void> => {
    if (isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);

    try {
      const response = await fetch(`/api/${agentId}/sessions`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data: { chatPath?: string } = await response.json();

      if (typeof data.chatPath !== 'string' || data.chatPath.length === 0) {
        throw new Error('Missing chatPath');
      }

      router.push(data.chatPath);
    } catch {
      window.alert('新建会话失败，请稍后重试。');
      setIsCreatingSession(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <ChatHeader
        status={status}
        title={agentTitle}
        isCreatingSession={isCreatingSession}
        onCreateSession={() => {
          void handleCreateSession();
        }}
      />

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        onScroll={updateAutoScrollState}
      >
        <div
          ref={messagesContentRef}
          className="mx-auto flex w-full max-w-4xl flex-col gap-4"
        >
          <ChatMessageList
            messages={visibleMessages}
            expandedStates={expandedStates}
            toolTimings={toolTimings}
            status={status}
            shouldShowPendingReply={shouldShowPendingReply}
            messagesEndRef={messagesEndRef}
            onToggleExpanded={toggleExpanded}
          />
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <ChatComposer
            isLoading={isLoading}
            isUploadingFiles={isUploadingFiles}
            hasError={error != null}
            canContinue={canContinueResponse}
            canSubmit={canSubmitMessage}
            attachments={composerAttachments}
            inputRef={inputRef}
            onFilesSelect={handleFilesSelect}
            onRemoveAttachment={handleRemoveAttachment}
            onSubmit={submitMessage}
            onContinue={handleContinue}
            onStop={handleStop}
          />
        </div>
      </div>
    </main>
  );
}

function normalizeInterruptedMessages(
  messages: UIMessage[],
  toolErrorText: string,
): UIMessage[] {
  let changed = false;
  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    const message = nextMessages[index];

    if (message.role !== 'assistant') {
      continue;
    }

    const normalizedParts: typeof message.parts = message.parts.map(part => {
      if (part.type === 'reasoning') {
        if (part.state !== 'streaming') {
          return part;
        }

        changed = true;
        return {
          ...part,
          state: 'done' as const,
        };
      }

      if (part.type === 'text') {
        if (part.state !== 'streaming') {
          return part;
        }

        changed = true;
        return {
          ...part,
          state: 'done' as const,
        };
      }

      if (!isToolUIPart(part)) {
        return part;
      }

      if (
        part.state === 'input-streaming' ||
        part.state === 'input-available' ||
        part.state === 'approval-requested' ||
        part.state === 'approval-responded'
      ) {
        changed = true;
        const { approval: _approval, output: _output, ...restPart } = part;
        void _approval;
        void _output;

        return {
          ...restPart,
          state: 'output-error' as const,
          errorText: toolErrorText,
        };
      }

      return part;
    });

    if (!changed) {
      return messages;
    }

    nextMessages[index] = {
      ...message,
      parts: normalizedParts,
    };

    return nextMessages;
  }

  return messages;
}

function isSameLocalFile(left: File, right: File): boolean {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified
  );
}

function toUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return '上传失败';
}

function normalizeMimeType(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : 'application/octet-stream';
}
