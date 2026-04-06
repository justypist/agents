'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, getToolName, isToolUIPart } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';

type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

type ToolTiming = {
  startedAt: number;
  finishedAt?: number;
};

type ToolTimingMap = Record<string, ToolTiming>;
type ExpandedStateMap = Record<string, boolean>;

const TOOL_LOG_LINE_LIMIT = 8;
const REASONING_LINE_LIMIT = 8;

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

function getReasoningText(text: string): string {
  return text.trim();
}

function getReasoningSummary(text: string): string {
  const normalizedText = getReasoningText(text).replace(/\s+/g, ' ');

  if (normalizedText.length === 0) {
    return '思考中';
  }

  if (normalizedText.length <= 72) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, 72)}...`;
}

function getPendingReplyLabel(status: string): string {
  return status === 'submitted' ? '已收到，正在思考...' : '正在生成回复...';
}

function formatJson(value: unknown): string {
  if (value == null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getToolStateMeta(
  state: ToolState,
  preliminary?: boolean,
): {
  label: string;
  description: string;
} {
  switch (state) {
    case 'input-streaming':
      return {
        label: '参数生成中',
        description: '模型正在组织这次工具调用的参数。',
      };
    case 'input-available':
      return {
        label: '已发起调用',
        description: '参数已确定，工具正在执行。',
      };
    case 'approval-requested':
      return {
        label: '等待授权',
        description: '工具调用需要额外授权后才能继续。',
      };
    case 'approval-responded':
      return {
        label: '授权已处理',
        description: '授权状态已返回，等待后续执行结果。',
      };
    case 'output-available':
      return {
        label: preliminary ? '已返回阶段结果' : '调用完成',
        description: preliminary
          ? '工具先返回了一版中间结果。'
          : '工具调用已完成并返回结果。',
      };
    case 'output-error':
      return {
        label: '调用失败',
        description: '工具执行时报错。',
      };
    case 'output-denied':
      return {
        label: '执行被拒绝',
        description: '工具调用没有被允许执行。',
      };
    default:
      return {
        label: state,
        description: '',
      };
  }
}

function isToolActive(state: ToolState, preliminary?: boolean): boolean {
  if (state === 'output-available') {
    return preliminary === true;
  }

  return (
    state === 'input-streaming' ||
    state === 'input-available' ||
    state === 'approval-requested' ||
    state === 'approval-responded'
  );
}

function isToolFinished(state: ToolState, preliminary?: boolean): boolean {
  if (state === 'output-available') {
    return preliminary !== true;
  }

  return state === 'output-error' || state === 'output-denied';
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 10000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}

function toLatestLines(text: string, prefix: string): string[] {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0)
    .map(line => `${prefix}${line}`);
}

function getLatestReasoningLines(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(-REASONING_LINE_LIMIT);
}

function getToolLiveLines(part: {
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  preliminary?: boolean;
}): string[] {
  const stateMeta = getToolStateMeta(part.state, part.preliminary);
  const lines: string[] = [`status  ${stateMeta.label}`];
  const inputText = formatJson(part.input);
  const outputText = formatJson(part.output);

  if (inputText) {
    lines.push(...toLatestLines(inputText, 'params  '));
  }

  if (outputText) {
    lines.push(...toLatestLines(outputText, 'output  '));
  }

  if (part.errorText) {
    lines.push(...toLatestLines(part.errorText, 'error   '));
  }

  return lines.slice(-TOOL_LOG_LINE_LIMIT);
}

function getToolDetailLines(part: {
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  preliminary?: boolean;
}): string[] {
  const stateMeta = getToolStateMeta(part.state, part.preliminary);
  const lines: string[] = [`status  ${stateMeta.label}`];
  const inputText = formatJson(part.input);
  const outputText = formatJson(part.output);

  if (inputText) {
    lines.push(...toLatestLines(inputText, 'params  '));
  }

  if (outputText) {
    lines.push(...toLatestLines(outputText, 'output  '));
  }

  if (part.errorText) {
    lines.push(...toLatestLines(part.errorText, 'error   '));
  }

  return lines;
}

function ToolCallLine({
  toolCallId,
  toolName,
  state,
  preliminary,
  input,
  output,
  errorText,
  timing,
  now,
  expanded,
  onToggle,
}: {
  toolCallId: string;
  toolName: string;
  state: ToolState;
  preliminary?: boolean;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  timing?: ToolTiming;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stateMeta = getToolStateMeta(state, preliminary);
  const active = isToolActive(state, preliminary);
  const allLines = getToolDetailLines({
    state,
    input,
    output,
    errorText,
    preliminary,
  });
  const detailLines = active
    ? getToolLiveLines({
        state,
        input,
        output,
        errorText,
        preliminary,
      })
    : allLines;
  const durationMs =
    timing == null
      ? undefined
      : (timing.finishedAt ?? now) - timing.startedAt;

  return (
    <section key={toolCallId} className="space-y-1 py-0.5 font-mono text-[13px] leading-6">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'tool-call-line',
          'w-full cursor-pointer text-left',
          active ? 'tool-call-line-running' : '',
          !active ? 'text-muted-foreground' : 'text-foreground',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="mr-2 text-muted-foreground">{expanded ? '[-]' : '[+]'}</span>
        <span className="mr-2 text-muted-foreground">tool</span>
        <span className={active ? 'tool-call-text-running' : 'mr-2'}>
          <span className="mr-2">{toolName}</span>
          <span className="mr-2 text-muted-foreground">·</span>
          <span className="mr-2">{stateMeta.label}</span>
        </span>
        {durationMs != null ? (
          <>
            <span className="mr-2 text-muted-foreground">·</span>
            <span>{formatDuration(durationMs)}</span>
          </>
        ) : null}
      </button>

      {expanded && detailLines.length > 0 ? (
        <pre className="tool-call-log whitespace-pre-wrap break-words text-muted-foreground">
          {detailLines.join('\n')}
        </pre>
      ) : null}
    </section>
  );
}

function ReasoningLine({
  text,
  state,
  expanded,
  onToggle,
}: {
  text: string;
  state?: 'streaming' | 'done';
  expanded: boolean;
  onToggle: () => void;
}) {
  const reasoningText = getReasoningText(text);
  const isStreaming = state === 'streaming';
  const detailLines = isStreaming
    ? getLatestReasoningLines(reasoningText)
    : reasoningText.length > 0
      ? reasoningText.split('\n').map(line => line.trimEnd()).filter(Boolean)
      : [];
  const summary = getReasoningSummary(reasoningText);

  return (
    <section className="space-y-1 py-0.5 font-mono text-[13px] leading-6">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'tool-call-line',
          'w-full cursor-pointer text-left',
          isStreaming ? 'tool-call-line-running text-foreground' : 'text-muted-foreground',
        ].join(' ')}
      >
        <span className="mr-2 text-muted-foreground">{expanded ? '[-]' : '[+]'}</span>
        <span className="mr-2 text-muted-foreground">reasoning</span>
        <span className={isStreaming ? 'tool-call-text-running' : undefined}>
          {isStreaming ? '思考中' : summary}
        </span>
      </button>

      {expanded && detailLines.length > 0 ? (
        <pre className="tool-call-log whitespace-pre-wrap break-words text-muted-foreground">
          {detailLines.join('\n')}
        </pre>
      ) : null}
    </section>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState('');
  const [toolTimings, setToolTimings] = useState<ToolTimingMap>({});
  const [expandedStates, setExpandedStates] = useState<ExpandedStateMap>({});
  const [now, setNow] = useState<number>(() => Date.now());
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

  useEffect(() => {
    const currentTime = Date.now();

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
                        const reasoningKey = `${message.id}:${index}:reasoning`;
                        const expanded =
                          expandedStates[reasoningKey] ?? part.state === 'streaming';

                        if (reasoningText.length === 0 && part.state !== 'streaming') {
                          return null;
                        }

                        return (
                          <ReasoningLine
                            key={`${message.id}-${index}`}
                            text={part.text}
                            state={part.state}
                            expanded={expanded}
                            onToggle={() => toggleExpanded(reasoningKey, expanded)}
                          />
                        );
                      }

                      if (part.type === 'text') {
                        return (
                          <p key={`${message.id}-${index}`} className="text-foreground">
                            {part.text}
                          </p>
                        );
                      }

                      if (isToolUIPart(part)) {
                        const expanded =
                          expandedStates[part.toolCallId] ??
                          isToolActive(
                            part.state,
                            'preliminary' in part ? part.preliminary : undefined,
                          );

                        return (
                          <ToolCallLine
                            key={`${message.id}-${index}`}
                            toolCallId={part.toolCallId}
                            toolName={getToolName(part)}
                            state={part.state}
                            preliminary={
                              'preliminary' in part ? part.preliminary : undefined
                            }
                            input={'input' in part ? part.input : undefined}
                            output={'output' in part ? part.output : undefined}
                            errorText={'errorText' in part ? part.errorText : undefined}
                            timing={toolTimings[part.toolCallId]}
                            now={now}
                            expanded={expanded}
                            onToggle={() =>
                              toggleExpanded(part.toolCallId, expanded)
                            }
                          />
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
