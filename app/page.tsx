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
                    {message.parts.map((part, index) =>
                      part.type === 'text' ? (
                        <p key={`${message.id}-${index}`}>{part.text}</p>
                      ) : null,
                    )}
                  </div>
                </article>
              ))}
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
