'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ChatComposer } from '@/components/chat/composer/chat-composer';
import { isToolActive, isToolFinished } from '@/components/chat/helpers';
import { ChatHeader } from '@/components/chat/layout/chat-header';
import { ChatMessageList } from '@/components/chat/message/chat-message-list';
import type { ExpandedStateMap, ToolTimingMap } from '@/components/chat/types';

type ChatPageProps = {
  agentId: string;
  sessionId: string;
  initialMessages: UIMessage[];
  agentTitle: string;
};

const AUTO_SCROLL_ENTER_THRESHOLD = 24;
const AUTO_SCROLL_EXIT_THRESHOLD = 80;
const INPUT_HISTORY_STORAGE_KEY = 'agents:chat-input-history';
const MAX_INPUT_HISTORY = 128;

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
  const inputDraftRef = useRef('');
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>(() =>
    readStoredInputHistory(),
  );
  const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [toolTimings, setToolTimings] = useState<ToolTimingMap>({});
  const [expandedStates, setExpandedStates] = useState<ExpandedStateMap>({});
  const [now, setNow] = useState<number>(() => Date.now());
  const [canContinue, setCanContinue] = useState(false);
  const stopRequestedRef = useRef(false);
  const { messages, sendMessage, setMessages, status, stop, error, clearError } =
    useChat({
      id: sessionId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/${agentId}/${sessionId}`,
      }),
    });
  const previousStatusRef = useRef(status);

  const isLoading = status === 'submitted' || status === 'streaming';
  const canContinueResponse = canContinue || error != null;
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

  const scrollToBottom = (): void => {
    const container = messagesContainerRef.current;

    if (container == null) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    shouldAutoScrollRef.current = true;
  };

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

  const submitMessage = (): void => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

    setCanContinue(false);
    inputDraftRef.current = '';
    setInputHistory(previous => appendInputHistory(previous, trimmedInput));
    setInputHistoryIndex(null);
    void sendMessage({ text: trimmedInput });
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

  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current) {
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
      if (!shouldAutoScrollRef.current) {
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
    inputRef.current?.focus();
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

  const hasActiveToolCall = useMemo(() => {
    return messages.some(message =>
      message.parts.some(part => {
        if (!isToolUIPart(part)) {
          return false;
        }

        return isToolActive(
          part.state,
          'preliminary' in part ? part.preliminary : undefined,
        );
      }),
    );
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

  useEffect(() => {
    if (!hasActiveToolCall) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 120);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasActiveToolCall]);

  const toggleExpanded = (key: string, currentExpanded: boolean): void => {
    setExpandedStates(previous => ({
      ...previous,
      [key]: !currentExpanded,
    }));
  };

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
            now={now}
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
            input={input}
            isLoading={isLoading}
            hasError={error != null}
            canContinue={canContinueResponse}
            inputRef={inputRef}
            onInputChange={handleInputChange}
            onHistoryNavigate={handleHistoryNavigate}
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
