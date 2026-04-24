'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChatComposer } from '@/components/chat/composer/chat-composer';
import { useChatAttachments } from '@/components/chat/hooks/use-chat-attachments';
import { useChatAutoScroll } from '@/components/chat/hooks/use-chat-auto-scroll';
import { useChatSessionActions } from '@/components/chat/hooks/use-chat-session-actions';
import { useToolTimings } from '@/components/chat/hooks/use-tool-timings';
import { ChatHeader } from '@/components/chat/layout/chat-header';
import { ChatMessageList } from '@/components/chat/message/chat-message-list';
import { normalizeInterruptedMessages } from '@/components/chat/message/normalize-interrupted-messages';
import type { ExpandedStateMap } from '@/components/chat/types';

type ChatPageProps = {
  agentId: string;
  sessionId: string;
  initialMessages: UIMessage[];
  initialTitle: string | null;
  fallbackTitle: string;
};

export function ChatPage({
  agentId,
  sessionId,
  initialMessages,
  initialTitle,
  fallbackTitle,
}: ChatPageProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [expandedStates, setExpandedStates] = useState<ExpandedStateMap>({});
  const [canContinue, setCanContinue] = useState(false);
  const stopRequestedRef = useRef(false);
  const { messages, sendMessage, setMessages, status, stop, error, clearError } =
    useChat({
      id: sessionId,
      messages: initialMessages,
      experimental_throttle: 50,
      onFinish: () => {
        router.refresh();
      },
      transport: new DefaultChatTransport({
        api: `/api/${agentId}/${sessionId}`,
      }),
    });
  const previousStatusRef = useRef(status);
  const {
    currentTitle,
    isCreatingSession,
    isRegeneratingTitle,
    handleCreateSession,
    handleRegenerateTitle,
  } = useChatSessionActions({
    agentId,
    sessionId,
    initialTitle,
    fallbackTitle,
  });
  const {
    composerAttachments,
    uploadedAttachments,
    isUploadingFiles,
    hasAttachmentErrors,
    handleFilesSelect,
    handleRemoveAttachment,
    clearAttachments,
  } = useChatAttachments();
  const {
    messagesContainerRef,
    messagesContentRef,
    messagesEndRef,
    updateAutoScrollState,
    scrollToBottom,
  } = useChatAutoScroll({ messages, status });
  const toolTimings = useToolTimings(messages);

  const isLoading = status === 'submitted' || status === 'streaming';
  const canContinueResponse = canContinue || error != null;
  const canSubmitMessage = !isLoading && !isUploadingFiles && !hasAttachmentErrors;
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
    clearAttachments();
  };
  useEffect(() => {
    inputRef.current?.focus();
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

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <ChatHeader
        status={status}
        title={currentTitle}
        isCreatingSession={isCreatingSession}
        isRegeneratingTitle={isRegeneratingTitle}
        onCreateSession={() => {
          void handleCreateSession();
        }}
        onRegenerateTitle={() => {
          void handleRegenerateTitle();
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
