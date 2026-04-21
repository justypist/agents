'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';

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

export function ChatPage({
  agentId,
  sessionId,
  initialMessages,
  agentTitle,
}: ChatPageProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState('');
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

  const submitMessage = (): void => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

    setCanContinue(false);
    void sendMessage({ text: trimmedInput });
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

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

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <ChatHeader status={status} title={agentTitle} />

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
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
            onInputChange={setInput}
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
