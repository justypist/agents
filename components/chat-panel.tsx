"use client";

import { useChat } from "@ai-sdk/react";
import {
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type FileUIPart,
  type DynamicToolUIPart,
} from "ai";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { type MainAgentUIMessage } from "@/agents/main";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type UploadedAttachment = {
  filename: string;
  mediaType: string;
  url: string;
};

type PresignedAttachmentUpload = UploadedAttachment & {
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

const ATTACHMENT_ERROR_TEXT = "当前仅支持图片和 PDF 附件";
const ABORTED_TOOL_ERROR_TEXT = "用户已停止本次执行";
const BOTTOM_THRESHOLD = 24;

type MainAgentMessagePart = MainAgentUIMessage["parts"][number];
type StaticToolPart = Exclude<
  Extract<MainAgentMessagePart, { toolCallId: string }>,
  { type: "dynamic-tool" }
>;

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

function getObjectRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getStringField(value: unknown, key: string) {
  const record = getObjectRecord(value);
  const fieldValue = record?.[key];

  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function getNumberField(value: unknown, key: string) {
  const record = getObjectRecord(value);
  const fieldValue = record?.[key];

  return typeof fieldValue === "number" ? fieldValue : undefined;
}

function getToolPartInput(part: StaticToolPart | DynamicToolUIPart) {
  if ("input" in part && part.input !== undefined) {
    return part.input;
  }

  if ("rawInput" in part) {
    return part.rawInput;
  }

  return undefined;
}

function getEntityLabel(entityType: string | undefined, id: string | undefined) {
  if (!entityType) {
    return id ? `定义：${id}` : "定义";
  }

  return id ? `${entityType}：${id}` : `${entityType}定义`;
}

function getDisplayId(id: string | undefined) {
  if (!id || id === "_" || id === "*" || id === "." || id === "/") {
    return undefined;
  }

  return id;
}

function getCreateRegistryEntryHint(part: StaticToolPart) {
  const input = getObjectRecord(getToolPartInput(part));
  const output = part.state === "output-available" ? getObjectRecord(part.output) : null;
  const inputValue = getObjectRecord(input?.value);
  const outputRecord = getObjectRecord(output?.record);
  const entityType =
    getStringField(input, "entityType") ?? getStringField(outputRecord, "entityType");
  const id = getStringField(inputValue, "id") ?? getStringField(outputRecord, "id");
  const label = getEntityLabel(entityType, id);

  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return `正在创建${label}`;
    case "output-available":
      return `已创建${label}`;
    case "output-error":
      return `创建${label}失败`;
    default:
      return null;
  }
}

function getReadRegistryEntryHint(part: StaticToolPart) {
  const input = getObjectRecord(getToolPartInput(part));
  const output = part.state === "output-available" ? getObjectRecord(part.output) : null;
  const mode = getStringField(output, "mode");
  const record = getObjectRecord(output?.record);
  const entityType =
    getStringField(record, "entityType") ??
    getStringField(output, "entityType") ??
    getStringField(input, "entityType");
  const id =
    getDisplayId(getStringField(record, "id")) ??
    getDisplayId(getStringField(input, "id"));
  const count = getNumberField(output, "count");

  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return id
        ? `正在读取${getEntityLabel(entityType, id)}`
        : `正在检查可复用的${getEntityLabel(entityType, undefined)}`;
    case "output-available":
      if (mode === "get" && id) {
        return `已读取${getEntityLabel(entityType, id)}`;
      }

      if (mode === "list" && typeof count === "number") {
        return `已检查${getEntityLabel(entityType, undefined)}，找到 ${count} 条`;
      }

      return `已检查${getEntityLabel(entityType, undefined)}`;
    case "output-error":
      return `读取${getEntityLabel(entityType, id)}失败`;
    default:
      return null;
  }
}

function getDeleteRegistryEntryHint(part: StaticToolPart) {
  const input = getObjectRecord(getToolPartInput(part));
  const output = part.state === "output-available" ? getObjectRecord(part.output) : null;
  const entityType =
    getStringField(input, "entityType") ?? getStringField(output, "entityType");
  const id = getStringField(input, "id") ?? getStringField(output, "id");
  const label = getEntityLabel(entityType, id);

  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return `正在删除${label}`;
    case "output-available":
      return `已删除${label}`;
    case "output-error":
      return `删除${label}失败`;
    default:
      return null;
  }
}

function getInvokeRegistryEntryHint(part: StaticToolPart) {
  const input = getObjectRecord(getToolPartInput(part));
  const output = part.state === "output-available" ? getObjectRecord(part.output) : null;
  const entityType =
    getStringField(input, "entityType") ?? getStringField(output, "entityType");
  const id =
    getDisplayId(getStringField(input, "id")) ??
    getDisplayId(getStringField(output, "id"));
  const label = getEntityLabel(entityType, id);

  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return `正在调用${label}`;
    case "output-available":
      if (part.preliminary) {
        return `${label} 正在流式返回`;
      }
      return `${label} 已执行完成`;
    case "output-error":
      return `调用${label}失败`;
    default:
      return null;
  }
}

function getStaticToolHint(part: StaticToolPart) {
  const toolName = part.type.replace(/^tool-/, "");

  switch (toolName) {
    case "createRegistryEntry":
      return getCreateRegistryEntryHint(part);
    case "readRegistryEntry":
      return getReadRegistryEntryHint(part);
    case "deleteRegistryEntry":
      return getDeleteRegistryEntryHint(part);
    case "invokeRegistryEntry":
      return getInvokeRegistryEntryHint(part);
    default:
      switch (part.state) {
        case "input-streaming":
        case "input-available":
          return `正在执行 tool：${toolName}`;
        case "output-available":
          if (part.preliminary) {
            return `tool：${toolName} 正在流式返回`;
          }
          return `tool：${toolName} 已执行完成`;
        case "output-error":
          return `tool：${toolName} 执行失败`;
        default:
          return null;
      }
  }
}

function getToolHint(part: StaticToolPart | DynamicToolUIPart) {
  if (part.type === "dynamic-tool") {
    switch (part.state) {
      case "input-streaming":
      case "input-available":
        return `正在调用 tool：${part.toolName}`;
      case "output-available":
        if (part.preliminary) {
          return `tool：${part.toolName} 正在流式返回`;
        }
        return `tool：${part.toolName} 已执行完成`;
      case "output-error":
        return `tool：${part.toolName} 执行失败`;
      default:
        return null;
    }
  }

  return getStaticToolHint(part);
}

function scrollWindowToBottom(
  behavior: ScrollBehavior,
  onComplete?: () => void
) {
  if (typeof window === "undefined") {
    onComplete?.();
    return;
  }

  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior,
  });

  if (!onComplete) {
    return;
  }

  if (behavior !== "smooth") {
    window.requestAnimationFrame(() => {
      onComplete();
    });
    return;
  }

  let frameCount = 0;

  const waitForScrollEnd = () => {
    const distanceFromBottom =
      document.documentElement.scrollHeight -
      (window.scrollY + window.innerHeight);

    if (distanceFromBottom <= BOTTOM_THRESHOLD || frameCount >= 120) {
      onComplete();
      return;
    }

    frameCount += 1;
    window.requestAnimationFrame(waitForScrollEnd);
  };

  window.requestAnimationFrame(waitForScrollEnd);
}

function isImageMediaType(mediaType: string) {
  return mediaType.startsWith("image/");
}

function isSupportedAttachment(file: File) {
  return isImageMediaType(file.type) || file.type === "application/pdf";
}

function getAttachmentLabel(file: FileUIPart) {
  if (file.filename && file.filename.trim().length > 0) {
    return file.filename;
  }

  return isImageMediaType(file.mediaType) ? "图片" : "附件";
}

function revokeAttachmentPreviews(attachments: PendingAttachment[]) {
  for (const attachment of attachments) {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "请求失败";
}

function finalizeStaticToolPart<T extends StaticToolPart>(part: T): T {
  if (part.state === "input-streaming") {
    return {
      ...part,
      state: "output-error",
      input: undefined,
      rawInput: part.input,
      errorText: ABORTED_TOOL_ERROR_TEXT,
    } as T;
  }

  if (part.state === "input-available") {
    return {
      ...part,
      state: "output-error",
      input: part.input,
      errorText: ABORTED_TOOL_ERROR_TEXT,
    } as T;
  }

  return part;
}

function finalizeDynamicToolPart(part: DynamicToolUIPart): DynamicToolUIPart {
  if (part.state !== "input-streaming" && part.state !== "input-available") {
    return part;
  }

  return {
    type: part.type,
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    title: part.title,
    providerExecuted: part.providerExecuted,
    state: "output-error",
    input: part.input,
    errorText: ABORTED_TOOL_ERROR_TEXT,
    callProviderMetadata: part.callProviderMetadata,
  };
}

function finalizePendingToolParts(messages: MainAgentUIMessage[]) {
  return messages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }

    let didChange = false;
    const parts = message.parts.map((part) => {
      if (!isToolUIPart(part)) {
        return part;
      }

      const isPendingToolPart =
        part.state === "input-streaming" || part.state === "input-available";

      if (!isPendingToolPart) {
        return part;
      }

      didChange = true;

      if (part.type === "dynamic-tool") {
        return finalizeDynamicToolPart(part);
      }

      return finalizeStaticToolPart(part);
    });

    if (!didChange) {
      return message;
    }

    return {
      ...message,
      parts,
    };
  });
}

function MessageAttachments({ files }: { files: FileUIPart[] }) {
  if (files.length === 0) {
    return null;
  }

  return (
    <section className="mt-3 flex flex-wrap gap-3">
      {files.map((file, index) => {
        const isImage = isImageMediaType(file.mediaType);
        const label = getAttachmentLabel(file);
        const key = `${file.url}-${index}`;

        if (isImage) {
          return (
            <a
              className="block overflow-hidden border border-border"
              href={file.url}
              key={key}
              rel="noreferrer"
              target="_blank"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={label}
                className="h-32 w-32 object-cover"
                src={file.url}
              />
            </a>
          );
        }

        return (
          <a
            className="flex min-w-48 items-center gap-3 border border-border px-3 py-2 text-sm"
            href={file.url}
            key={key}
            rel="noreferrer"
            target="_blank"
          >
            <span className="text-xs uppercase text-muted-foreground">文件</span>
            <span className="truncate">{label}</span>
          </a>
        );
      })}
    </section>
  );
}

function MessageView({ message }: { message: MainAgentUIMessage }) {
  const text = getMessageText(message);
  const fileParts = message.parts.filter(isFileUIPart);
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
          part.type === "dynamic-tool"
            ? part.toolName
            : part.type.replace(/^tool-/, "");
        const toolHint = getToolHint(part);

        return (
          <div className="mt-2" key={`${message.id}-tool-${index}`}>
            <details className="border border-border px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                tool: {toolName} ({part.state})
              </summary>

              {"input" in part ? (
                <div className="mt-2">
                  <div className="mb-1 text-xs text-muted-foreground">input</div>
                  <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs">
                    {formatValue(part.input)}
                  </pre>
                </div>
              ) : null}

              {part.state === "output-available" ? (
                <div className="mt-2">
                  <div className="mb-1 text-xs text-muted-foreground">output</div>
                  <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs">
                    {formatValue(part.output)}
                  </pre>
                </div>
              ) : null}

              {"errorText" in part && part.errorText ? (
                <pre className="mt-2 whitespace-pre-wrap wrap-break-word font-mono text-xs text-destructive">
                  {part.errorText}
                </pre>
              ) : null}
            </details>

            {toolHint ? (
              <div className="px-1 pt-1 text-sm text-muted-foreground">
                {toolHint}
              </div>
            ) : null}
          </div>
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
          <pre className="mt-2 whitespace-pre-wrap wrap-break-word font-mono text-xs">
            {part.text}
          </pre>
        </details>
      ))}

      {text ? (
        <div className="mt-2 whitespace-pre-wrap wrap-break-word">{text}</div>
      ) : null}

      <MessageAttachments files={fileParts} />

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
  const { messages, sendMessage, setMessages, status, stop, error } =
    useChat<MainAgentUIMessage>();
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const shouldStickToBottomRef = useRef(true);
  const shouldFocusInputAfterScrollRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAtPageBottom, setIsAtPageBottom] = useState(true);
  const isPending = status === "submitted" || status === "streaming";
  const isBusy = isPending || isUploadingAttachments;
  const canSubmit = input.trim().length > 0 || pendingAttachments.length > 0;
  const statusText = isUploadingAttachments ? "上传附件中" : getStatusText(status);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(
    () => () => {
      revokeAttachmentPreviews(pendingAttachmentsRef.current);
    },
    []
  );

  const syncScrollState = () => {
    if (typeof window === "undefined") {
      return;
    }

    const distanceFromBottom =
      document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    const isNearBottom = distanceFromBottom <= BOTTOM_THRESHOLD;

    shouldStickToBottomRef.current = isNearBottom;
    setIsAtPageBottom(isNearBottom);
  };

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
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncScrollState();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [messages, status]);

  useEffect(() => {
    if (!isAtPageBottom || !shouldFocusInputAfterScrollRef.current) {
      return;
    }

    shouldFocusInputAfterScrollRef.current = false;
    textareaRef.current?.focus();
  }, [isAtPageBottom]);

  async function uploadAttachment(file: File): Promise<UploadedAttachment> {
    const signResponse = await fetch("/api/files", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: file.name || "upload",
        mediaType: file.type,
        size: file.size,
      }),
    });

    if (!signResponse.ok) {
      const result = (await signResponse.json().catch(() => null)) as
        | { error?: string }
        | null;

      throw new Error(result?.error || "附件上传失败");
    }

    const result = (await signResponse.json()) as PresignedAttachmentUpload;
    const uploadResponse = await fetch(result.uploadUrl, {
      method: result.uploadMethod,
      headers: result.uploadHeaders,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("附件直传失败");
    }

    return {
      filename: result.filename,
      mediaType: result.mediaType,
      url: result.url,
    };
  }

  function appendFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);

    if (files.length === 0) {
      return;
    }

    const supportedFiles = files.filter(isSupportedAttachment);

    setAttachmentError(
      supportedFiles.length === files.length ? "" : ATTACHMENT_ERROR_TEXT
    );

    if (supportedFiles.length === 0) {
      return;
    }

    setPendingAttachments((current) => [
      ...current,
      ...supportedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: isImageMediaType(file.type) ? URL.createObjectURL(file) : null,
      })),
    ]);
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => {
      const next: PendingAttachment[] = [];

      for (const attachment of current) {
        if (attachment.id === id) {
          if (attachment.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
          continue;
        }

        next.push(attachment);
      }

      return next;
    });
  }

  function clearPendingAttachments() {
    setPendingAttachments((current) => {
      revokeAttachmentPreviews(current);
      return [];
    });
    setAttachmentError("");
  }

  function handleImageInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      appendFiles(event.target.files);
    }

    event.target.value = "";
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      appendFiles(event.target.files);
    }

    event.target.value = "";
  }

  async function submitCurrentInput() {
    const text = input.trim();
    const attachments = pendingAttachments;

    if ((!text && attachments.length === 0) || isBusy) {
      return;
    }

    shouldStickToBottomRef.current = true;
    setInput("");
    setPendingAttachments([]);
    setAttachmentError("");
    setIsDragActive(false);

    try {
      if (attachments.length === 0) {
        await sendMessage({ text });
        return;
      }

      setIsUploadingAttachments(true);
      const uploadedAttachments = await Promise.all(
        attachments.map((attachment) => uploadAttachment(attachment.file))
      );

      const parts: MainAgentUIMessage["parts"] = [
        ...uploadedAttachments.map((attachment) => ({
          type: "file" as const,
          filename: attachment.filename,
          mediaType: attachment.mediaType,
          url: attachment.url,
        })),
        ...(text
          ? [
              {
                type: "text" as const,
                text,
              },
            ]
          : []),
      ];

      await sendMessage({ parts });
      revokeAttachmentPreviews(attachments);
    } catch (error) {
      setInput(text);
      setPendingAttachments(attachments);
      setAttachmentError(getErrorMessage(error));
    } finally {
      setIsUploadingAttachments(false);
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

  function handleDragEnter(event: DragEvent<HTMLFormElement>) {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }

    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    if (!event.dataTransfer.files.length) {
      return;
    }

    event.preventDefault();
    setIsDragActive(false);
    appendFiles(event.dataTransfer.files);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(event.clipboardData.items);
    const files = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    appendFiles(files);
  }

  function handleStop() {
    stop();
    setMessages((currentMessages) => finalizePendingToolParts(currentMessages));
  }

  return (
    <section className="relative border border-border">
      <header className="border-b border-border px-3 py-2">
        <div className="text-xs text-muted-foreground">
          状态：{statusText}
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

      {!isAtPageBottom ? (
        <button
          className="fixed right-4 bottom-4 z-20 border border-border bg-background px-3 py-1.5 text-sm shadow-sm"
          onClick={() => {
            shouldStickToBottomRef.current = true;
            scrollWindowToBottom("smooth", () => {
              shouldFocusInputAfterScrollRef.current = true;
              syncScrollState();
            });
          }}
          type="button"
        >
          滚动到底
        </button>
      ) : null}

      <div className="border-t border-border bg-background p-3">
        {error ? (
          <div className="mb-3 border border-destructive px-3 py-2 text-sm text-destructive">
            {error.message}
          </div>
        ) : null}

        {attachmentError ? (
          <div className="mb-3 border border-destructive px-3 py-2 text-sm text-destructive">
            {attachmentError}
          </div>
        ) : null}

        <form
          className={`relative ${isDragActive ? "border-dashed border-primary" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onSubmit={handleSubmit}
        >
          <input
            accept="image/*,application/pdf"
            className="hidden"
            multiple
            onChange={handleImageInputChange}
            ref={imageInputRef}
            type="file"
          />
          <input
            accept="image/*,application/pdf"
            className="hidden"
            multiple
            onChange={handleFileInputChange}
            ref={fileInputRef}
            type="file"
          />

          <label className="mb-2 block text-sm" htmlFor="chat-input">
            输入
          </label>

          {pendingAttachments.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingAttachments.map((attachment) => {
                const isImage = isImageMediaType(attachment.file.type);

                return (
                  <div
                    className="relative flex items-center gap-2 border border-border bg-background px-2 py-2"
                    key={attachment.id}
                  >
                    {isImage && attachment.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={attachment.file.name}
                        className="h-12 w-12 object-cover"
                        src={attachment.previewUrl}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center border border-border text-xs text-muted-foreground">
                        文件
                      </div>
                    )}

                    <div className="min-w-0 max-w-48">
                      <div className="truncate text-sm">
                        {attachment.file.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isImage ? "图片" : "附件"}
                      </div>
                    </div>

                    <button
                      className="border border-border px-2 py-1 text-xs disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => {
                        removePendingAttachment(attachment.id);
                      }}
                      type="button"
                    >
                      移除
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <textarea
            className="min-h-24 w-full resize-y border border-border bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            autoFocus
            id="chat-input"
            onChange={(event) => {
              setInput(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行。可点击按钮或直接拖入图片、PDF 附件。"
            ref={textareaRef}
            rows={4}
            value={input}
          />

          {isDragActive ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center border border-dashed border-primary bg-background/90 text-sm text-foreground">
              松开鼠标，添加图片或 PDF 附件
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="border border-border px-3 py-1 text-sm disabled:opacity-50"
                disabled={isBusy}
                onClick={() => {
                  imageInputRef.current?.click();
                }}
                type="button"
              >
                添加图片
              </button>
              <button
                className="border border-border px-3 py-1 text-sm disabled:opacity-50"
                disabled={isBusy}
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                type="button"
              >
                添加附件
              </button>
              {pendingAttachments.length > 0 ? (
                <button
                  className="border border-border px-3 py-1 text-sm disabled:opacity-50"
                  disabled={isBusy}
                  onClick={clearPendingAttachments}
                  type="button"
                >
                  清空附件
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isPending ? (
                <button
                  className="border border-border px-3 py-1 text-sm"
                  onClick={handleStop}
                  type="button"
                >
                  停止
                </button>
              ) : null}
              <button
                className="border border-border px-3 py-1 text-sm disabled:opacity-50"
                disabled={isBusy || !canSubmit}
                type="submit"
              >
                {isUploadingAttachments ? "上传中" : "发送"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
