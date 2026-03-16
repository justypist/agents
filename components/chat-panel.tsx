"use client";

import { useChat } from "@ai-sdk/react";
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from "ai";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { MainAgentUIMessage } from "@/agents/main";

function getStatusText(status: "submitted" | "streaming" | "ready" | "error") {
  switch (status) {
    case "submitted":
      return "请求已发送";
    case "streaming":
      return "生成中";
    case "error":
      return "请求失败";
    case "ready":
    default:
      return "就绪";
  }
}

function getMessageText(message: MainAgentUIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    const result = JSON.stringify(value, null, 2);
    return result ?? String(value);
  } catch {
    return String(value);
  }
}

function scrollWindowToBottom(behavior: ScrollBehavior) {
  if (typeof window === "undefined") {
    return;
  }

  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior,
  });
}

function MessageView({ message }: { message: MainAgentUIMessage }) {
  const text = getMessageText(message);
  const reasoningParts = message.parts.filter(isReasoningUIPart);
  const toolParts = message.parts.filter(isToolUIPart);
  const sourceParts = message.parts.filter((part) => part.type === "source-url");

  return (
    <article className="border border-border px-3 py-3">
      <div className="mb-2 text-xs uppercase text-muted-foreground">
        {message.role}
      </div>

      {toolParts.map((part, index) => {
        const toolName =
          part.type === "dynamic-tool" ? part.toolName : part.type;

        return (
          <details
            className="mt-2 border border-border px-3 py-2"
            key={`${message.id}-tool-${index}`}
          >
            <summary className="cursor-pointer text-xs text-muted-foreground">
              tool: {toolName} ({part.state})
            </summary>

            {"input" in part ? (
              <div className="mt-2">
                <div className="mb-1 text-xs text-muted-foreground">input</div>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                  {formatValue(part.input)}
                </pre>
              </div>
            ) : null}

            {"output" in part ? (
              <div className="mt-2">
                <div className="mb-1 text-xs text-muted-foreground">output</div>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                  {formatValue(part.output)}
                </pre>
              </div>
            ) : null}

            {"errorText" in part && part.errorText ? (
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-destructive">
                {part.errorText}
              </pre>
            ) : null}
          </details>
        );
      })}

      {reasoningParts.map((part, index) => (
        <details
          className="mt-2 border border-border px-3 py-2"
          key={`${message.id}-reasoning-${index}`}
        >
          <summary className="cursor-pointer text-xs text-muted-foreground">
            reasoning
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
            {part.text}
          </pre>
        </details>
      ))}

      {text ? <div className="mt-2 whitespace-pre-wrap break-words">{text}</div> : null}

      {sourceParts.length > 0 ? (
        <section className="mt-2 border border-border px-3 py-2">
          <div className="text-xs text-muted-foreground">sources</div>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {sourceParts.map((part) => (
              <a
                className="break-all underline"
                href={part.url}
                key={part.sourceId}
                rel="noreferrer"
                target="_blank"
              >
                {part.title || part.url}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function ChatPanel() {
  const { messages, sendMessage, status, stop, error } =
    useChat<MainAgentUIMessage>();
  const [input, setInput] = useState("");
  const composerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const [composerHeight, setComposerHeight] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isPending = status === "submitted" || status === "streaming";

  const syncScrollState = useEffectEvent(() => {
    if (typeof window === "undefined") {
      return;
    }

    const distanceFromBottom =
      document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    const isNearBottom = distanceFromBottom <= composerHeight + 120;

    shouldStickToBottomRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom);
  });

  useEffect(() => {
    const composerElement = composerRef.current;
    if (!composerElement) {
      return;
    }

    const updateComposerHeight = () => {
      setComposerHeight(composerElement.getBoundingClientRect().height);
    };

    updateComposerHeight();

    const observer = new ResizeObserver(() => {
      updateComposerHeight();
      syncScrollState();
    });

    observer.observe(composerElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncScrollState();
    });

    const handleWindowScroll = () => {
      syncScrollState();
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    window.addEventListener("resize", handleWindowScroll);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", handleWindowScroll);
      window.removeEventListener("resize", handleWindowScroll);
    };
  }, [composerHeight]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) {
      return;
    }

    scrollWindowToBottom("auto");
    const frameId = window.requestAnimationFrame(() => {
      syncScrollState();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [messages, status]);

  async function submitCurrentInput() {
    const text = input.trim();

    if (!text || isPending) {
      return;
    }

    shouldStickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setInput("");

    try {
      await sendMessage({ text });
    } catch {
      setInput(text);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCurrentInput();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitCurrentInput();
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInput(event.target.value);
  }

  return (
    <section className="relative border border-border">
      <header className="border-b border-border px-3 py-2">
        <div className="text-sm font-medium">Chat</div>
        <div className="text-xs text-muted-foreground">
          状态：{getStatusText(status)}
        </div>
      </header>

      <div className="p-3">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
              暂无消息。输入问题后开始对话。
            </div>
          ) : (
            messages.map((message) => (
              <MessageView key={message.id} message={message} />
            ))
          )}
        </div>
      </div>

      <div style={{ height: composerHeight }} />

      {showScrollToBottom ? (
        <button
          className="fixed right-4 bottom-4 z-20 border border-border bg-background px-3 py-1.5 text-sm shadow-sm"
          onClick={() => {
            shouldStickToBottomRef.current = true;
            setShowScrollToBottom(false);
            scrollWindowToBottom("smooth");
          }}
          style={{ bottom: `${composerHeight + 16}px` }}
          type="button"
        >
          滚动到底
        </button>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10">
        <div className="mx-auto w-full max-w-4xl px-4">
          <div
            className="pointer-events-auto border border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            ref={composerRef}
          >
            {error ? (
              <div className="mb-3 border border-destructive px-3 py-2 text-sm text-destructive">
                {error.message}
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <label className="mb-2 block text-sm" htmlFor="chat-input">
                输入
              </label>
              <textarea
                className="min-h-24 w-full resize-y border border-border bg-transparent px-3 py-2 text-sm outline-none"
                id="chat-input"
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="输入问题，Enter 发送，Shift+Enter 换行"
                rows={4}
                value={input}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Enter 发送，Shift+Enter 换行
                </div>
                <div className="flex items-center gap-2">
                  {isPending ? (
                    <button
                      className="border border-border px-3 py-1 text-sm"
                      onClick={stop}
                      type="button"
                    >
                      停止
                    </button>
                  ) : null}
                  <button
                    className="border border-border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={isPending || input.trim().length === 0}
                    type="submit"
                  >
                    发送
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
