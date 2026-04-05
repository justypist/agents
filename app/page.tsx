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
    <main className="flex h-screen flex-col bg-white text-black">
      <div className="border-b border-black px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-medium">聊天</h1>
          <span>{getStatusLabel(status)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {messages.length === 0 ? (
            <p className="text-sm text-neutral-500">还没有消息</p>
          ) : (
            <>
              {messages.map(message => (
                <article key={message.id} className="border-b border-black pb-4">
                  <p className="mb-2 text-xs uppercase">
                    {message.role === 'user' ? 'User' : 'Agent'}
                  </p>
                  <div className="space-y-2 whitespace-pre-wrap break-words text-sm leading-6">
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
                            className="rounded-sm border border-neutral-200 bg-neutral-50/60 px-3 py-2 text-neutral-500"
                          >
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                              {getReasoningLabel(part.state)}
                            </p>
                            <p>{isEmptyReasoning ? '思考中...' : reasoningText}</p>
                          </section>
                        );
                      }

                      if (part.type === 'text') {
                        return (
                          <p key={`${message.id}-${index}`} className="text-black">
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
                <article className="border-b border-black pb-4">
                  <p className="mb-2 text-xs uppercase">Agent</p>
                  <div className="space-y-2 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-500">
                    <p>{getPendingReplyLabel(status)}</p>
                  </div>
                </article>
              ) : null}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      <div className="border-t border-black px-4 py-4">
        <div className="mx-auto w-full max-w-4xl">
          {error ? (
            <p className="mb-3 text-sm">出现错误，请稍后重试。</p>
          ) : null}

          <form
            className="flex items-end gap-3"
            onSubmit={event => {
              event.preventDefault();
              submitMessage();
            }}
          >
            <label className="flex-1">
              <span className="sr-only">输入消息</span>
              <textarea
                ref={inputRef}
                className="min-h-24 w-full resize-none border border-black bg-white px-3 py-2 text-sm leading-6 outline-none"
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
                className="h-10 border border-black px-4 text-sm"
              >
                停止
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              className="h-10 border border-black px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              发送
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
