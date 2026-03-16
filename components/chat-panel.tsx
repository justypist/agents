"use client";

import { useChat } from "@ai-sdk/react";
import { isReasoningUIPart, isTextUIPart, isToolUIPart } from "ai";
import {
  useEffect,
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

      {reasoningParts.map((part, index) => (
        <details
          className="mb-2 border border-border px-3 py-2"
          key={`${message.id}-reasoning-${index}`}
          open={part.state === "streaming"}
        >
          <summary className="cursor-pointer text-xs text-muted-foreground">
            reasoning
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
            {part.text}
          </pre>
        </details>
      ))}

      {text ? <div className="whitespace-pre-wrap break-words">{text}</div> : null}

      {toolParts.map((part, index) => {
        const toolName =
          part.type === "dynamic-tool" ? part.toolName : part.type;

        return (
          <section
            className="mt-2 border border-border px-3 py-2"
            key={`${message.id}-tool-${index}`}
          >
            <div className="text-xs text-muted-foreground">
              tool: {toolName} ({part.state})
            </div>

            {"input" in part ? (
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                {formatValue(part.input)}
              </pre>
            ) : null}

            {"output" in part ? (
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">
                {formatValue(part.output)}
              </pre>
            ) : null}

            {"errorText" in part && part.errorText ? (
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-destructive">
                {part.errorText}
              </pre>
            ) : null}
          </section>
        );
      })}

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isPending = status === "submitted" || status === "streaming";

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [messages, status]);

  async function submitCurrentInput() {
    const text = input.trim();

    if (!text || isPending) {
      return;
    }

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
    <section className="flex h-full min-h-0 flex-col border border-border">
      <header className="border-b border-border px-3 py-2">
        <div className="text-sm font-medium">Chat</div>
        <div className="text-xs text-muted-foreground">
          状态：{getStatusText(status)}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="flex min-h-full flex-col gap-3 p-3">
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

      {error ? (
        <div className="border-t border-border px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      <form className="border-t border-border p-3" onSubmit={handleSubmit}>
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
    </section>
  );
}
