'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';

function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':
      return '请求已发送';
    case 'streaming':
      return '正在回复';
    case 'error':
      return '请求失败';
    default:
      return '准备就绪';
  }
}

function getReasoningLabel(state?: 'streaming' | 'done'): string {
  return state === 'streaming' ? '思考中' : '思考过程';
}

function getReasoningText(text: string): string {
  return text.trim();
}

function getPendingReplyLabel(status: string): string {
  return status === 'submitted' ? '已收到，正在思考...' : '正在生成回复...';
}

export default function Home() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });
  const previousStatusRef = useRef(status);

  const isLoading = status === 'submitted' || status === 'streaming';
  const lastMessage = messages[messages.length - 1];
  const shouldShowPendingReply =
    isLoading &&
    (lastMessage == null ||
      lastMessage.role !== 'assistant' ||
      lastMessage.parts.length === 0);

  const submitMessage = (): void => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

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

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="border-b border-border px-4 py-3">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <h1 className="text-sm font-medium tracking-[-0.01em]">聊天</h1>
          <span className="text-sm text-muted-foreground">{getStatusLabel(status)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有消息</p>
          ) : (
            <>
              {messages.map(message => (
                <article key={message.id} className="border-b border-border pb-4">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {message.role === 'user' ? 'User' : 'Agent'}
                  </p>
                  <div className="space-y-2 whitespace-pre-wrap break-words text-sm leading-7 tracking-[-0.01em]">
                    {message.parts.map((part, index) => {
                      if (part.type === 'reasoning') {
                        const reasoningText = getReasoningText(part.text);
                        const isEmptyReasoning = reasoningText.length === 0;

                        if (isEmptyReasoning && part.state !== 'streaming') {
                          return null;
                        }

                        return (
                          <section
                            key={`${message.id}-${index}`}
                            className="border border-border px-3 py-2 text-muted-foreground"
                          >
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              {getReasoningLabel(part.state)}
                            </p>
                            <p>{isEmptyReasoning ? '思考中...' : reasoningText}</p>
                          </section>
                        );
                      }

                      if (part.type === 'text') {
                        return (
                          <p key={`${message.id}-${index}`} className="text-foreground">
                            {part.text}
                          </p>
                        );
                      }

                      return null;
                    })}
                  </div>
                </article>
              ))}
              {shouldShowPendingReply ? (
                <article className="border-b border-border pb-4">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Agent
                  </p>
                  <div className="space-y-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                    <p>{getPendingReplyLabel(status)}</p>
                  </div>
                </article>
              ) : null}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          {error ? (
            <p className="mb-3 text-sm text-muted-foreground">出现错误，请稍后重试。</p>
          ) : null}

          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={event => {
              event.preventDefault();
              submitMessage();
            }}
          >
            <label className="flex-1">
              <span className="sr-only">输入消息</span>
              <textarea
                ref={inputRef}
                className="min-h-24 w-full resize-none border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong"
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && event.ctrlKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                placeholder="输入你的问题..."
                disabled={isLoading}
              />
            </label>

            {isLoading ? (
              <button
                type="button"
                onClick={() => stop()}
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
        </div>
      </div>
    </main>
  );
}
