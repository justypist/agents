'use client';

import { generateId, type FileUIPart, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChatComposer } from '@/components/chat/composer/chat-composer';
import { useChatAttachments } from '@/components/chat/hooks/use-chat-attachments';
import { useChatAutoScroll } from '@/components/chat/hooks/use-chat-auto-scroll';
import { useChatSessionActions } from '@/components/chat/hooks/use-chat-session-actions';
import { useToolTimings } from '@/components/chat/hooks/use-tool-timings';
import { ChatHeader } from '@/components/chat/layout/chat-header';
import { ChatMessageList } from '@/components/chat/message/chat-message-list';
import type { ExpandedStateMap } from '@/components/chat/types';
import { SkillEditor } from '@/components/skills/skill-editor';
import type { SkillView } from '@/components/skills/types';
import type { ChatSessionTurnState, StoredChatSession } from '@/lib/chat-session';

type ChatPageProps = {
  agentId: string;
  sessionId: string;
  initialMessages: UIMessage[];
  initialTurnState: ChatSessionTurnState;
  initialTitle: string | null;
  fallbackTitle: string;
  initialSkills: SkillView[];
};

type SkillSelectionMode = 'create' | 'adjust';

type ChatSubmitStatus = 'ready' | 'submitted' | 'error';

type DraftSkillForm = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  content: string;
};

export function ChatPage({
  agentId,
  sessionId,
  initialMessages,
  initialTurnState,
  initialTitle,
  fallbackTitle,
  initialSkills,
}: ChatPageProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [expandedStates, setExpandedStates] = useState<ExpandedStateMap>({});
  const [canContinue, setCanContinue] = useState(false);
  const [skillSelectionMode, setSkillSelectionMode] =
    useState<SkillSelectionMode | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [availableSkills, setAvailableSkills] = useState(initialSkills);
  const [createSkillName, setCreateSkillName] = useState('');
  const [createSkillDescription, setCreateSkillDescription] = useState('');
  const [adjustSkillId, setAdjustSkillId] = useState(initialSkills[0]?.id ?? '');
  const [adjustPrompt, setAdjustPrompt] = useState('');
  const [draftSkill, setDraftSkill] = useState<DraftSkillForm | null>(null);
  const [skillPanelError, setSkillPanelError] = useState<string | null>(null);
  const [skillPanelMessage, setSkillPanelMessage] = useState<string | null>(null);
  const [isGeneratingSkill, setIsGeneratingSkill] = useState(false);
  const [isSavingDraftSkill, setIsSavingDraftSkill] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [turnState, setTurnState] = useState(initialTurnState);
  const [submitStatus, setSubmitStatus] = useState<ChatSubmitStatus>('ready');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const status = turnState.status === 'running' ? 'submitted' : submitStatus;
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

  const isTurnRunning = turnState.status === 'running';
  const isSubmitting = submitStatus === 'submitted';
  const isLoading = isSubmitting || isTurnRunning;
  const canContinueResponse = canContinue || submitError != null;
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
    (isLoading || isTurnRunning) &&
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
    setSubmitError(null);
    scrollToBottom('smooth');
    const userMessage: UIMessage = {
      id: generateId(),
      role: 'user',
      parts: [
        ...(trimmedInput.length > 0
          ? [{ type: 'text' as const, text: trimmedInput }]
          : []),
        ...files,
      ],
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setTurnState({
      status: 'running',
      currentUserMessageId: userMessage.id,
      errorSummary: null,
      updatedAt: new Date().toISOString(),
    });
    setSubmitStatus('submitted');
    void submitTurn(nextMessages);
    clearAttachments();
  };

  const submitTurn = async (nextMessages: UIMessage[]): Promise<void> => {
    try {
      const response = await fetch(`/api/${agentId}/${sessionId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: sessionId, messages: nextMessages }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readError(payload, '发送消息失败'));
      }

      if (!isSessionPayload(payload)) {
        throw new Error('会话响应格式无效');
      }

      setMessages(payload.session.messages);
      setTurnState(payload.session.turnState);
      setSubmitStatus('ready');
      router.refresh();
    } catch (submitErrorValue) {
      setSubmitStatus('error');
      setSubmitError(
        submitErrorValue instanceof Error
          ? submitErrorValue.message
          : '发送消息失败',
      );
    }
  };

  const refreshSessionSnapshot = useCallback(async (): Promise<StoredChatSession> => {
    const response = await fetch(`/api/sessions/${sessionId}`);
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new Error(readError(payload, '刷新会话失败'));
    }

    if (!isSessionPayload(payload)) {
      throw new Error('会话响应格式无效');
    }

    return payload.session;
  }, [sessionId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (status === 'ready' && previousStatus === 'submitted') {
      inputRef.current?.focus();
    }

    previousStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isTurnRunning) {
      return;
    }

    let isActive = true;

    const refresh = async (): Promise<void> => {
      try {
        const session = await refreshSessionSnapshot();

        if (!isActive) {
          return;
        }

        setMessages(session.messages);
        setTurnState(session.turnState);

        if (session.turnState.status !== 'running') {
          router.refresh();
        }
      } catch (refreshError) {
        if (!isActive) {
          return;
        }

        setSubmitError(
          refreshError instanceof Error ? refreshError.message : '刷新会话失败',
        );
      }
    };
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 2000);

    void refresh();

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [isTurnRunning, refreshSessionSnapshot, router]);

  const handleStop = (): void => {
    setSubmitError('后台回复已开始，关闭页面不会中断执行。');
  };

  const handleContinue = (): void => {
    if (isLoading || messages.length === 0) {
      return;
    }

    setCanContinue(false);
    setSubmitError(null);
    submitMessage('请从上一条助手回复中断的位置继续，不要重复已经完成的内容。只补全后续内容。');
  };

  const toggleExpanded = useCallback((key: string, currentExpanded: boolean): void => {
    setExpandedStates(previous => ({
      ...previous,
      [key]: !currentExpanded,
    }));
  }, []);

  const beginSkillSelection = (mode: SkillSelectionMode): void => {
    setSkillSelectionMode(mode);
    setSelectedMessageIds([]);
    setDraftSkill(null);
    setSkillPanelError(null);
    setSkillPanelMessage(
      mode === 'create'
        ? '请选择一条或多条消息来生成新 skill。'
        : '请选择消息，并选择要调整的目标 skill。',
    );
  };

  const cancelSkillSelection = (): void => {
    setSkillSelectionMode(null);
    setSelectedMessageIds([]);
    setDraftSkill(null);
    setSkillPanelError(null);
    setSkillPanelMessage(null);
  };

  const toggleSelectedMessage = useCallback((messageId: string): void => {
    setSelectedMessageIds(previous =>
      previous.includes(messageId)
        ? previous.filter(id => id !== messageId)
        : [...previous, messageId],
    );
  }, []);

  const generateSkillFromSelection = async (): Promise<void> => {
    if (skillSelectionMode == null || selectedMessageIds.length === 0) {
      setSkillPanelError('请至少选择一条消息');
      return;
    }

    setIsGeneratingSkill(true);
    setSkillPanelError(null);
    setSkillPanelMessage(null);

    try {
      const response = await fetch(
        skillSelectionMode === 'create'
          ? '/api/skills/from-session'
          : `/api/skills/${adjustSkillId}/adjust-from-session`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            skillSelectionMode === 'create'
              ? {
                  sessionId,
                  messageIds: selectedMessageIds,
                  name: createSkillName.trim() || undefined,
                  description: createSkillDescription.trim() || undefined,
                }
              : {
                  sessionId,
                  messageIds: selectedMessageIds,
                  prompt: adjustPrompt.trim() || undefined,
                },
          ),
        },
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readError(payload, '生成 skill 失败'));
      }

      if (!isSkillPayload(payload)) {
        throw new Error('skill 响应格式无效');
      }

      const skill = payload.skill;
      setDraftSkill(skillToDraft(skill));
      setAvailableSkills(previous => upsertSkill(previous, skill));
      setAdjustSkillId(skill.id);
      setSkillPanelMessage('已生成草案，可继续编辑后保存。');
    } catch (generateError) {
      setSkillPanelError(
        generateError instanceof Error ? generateError.message : '生成 skill 失败',
      );
    } finally {
      setIsGeneratingSkill(false);
    }
  };

  const saveDraftSkill = async (): Promise<void> => {
    if (draftSkill == null) {
      return;
    }

    setIsSavingDraftSkill(true);
    setSkillPanelError(null);
    setSkillPanelMessage(null);

    try {
      const response = await fetch(`/api/skills/${draftSkill.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: draftSkill.name,
          displayName: draftSkill.displayName,
          description: draftSkill.description,
          content: draftSkill.content,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readError(payload, '保存 skill 草案失败'));
      }

      if (!isSkillPayload(payload)) {
        throw new Error('skill 响应格式无效');
      }

      setDraftSkill(skillToDraft(payload.skill));
      setAvailableSkills(previous => upsertSkill(previous, payload.skill));
      setSkillPanelMessage('Skill 草案已保存，默认保持停用，可前往 Skills 页面启用。');
      router.refresh();
    } catch (saveError) {
      setSkillPanelError(
        saveError instanceof Error ? saveError.message : '保存 skill 草案失败',
      );
    } finally {
      setIsSavingDraftSkill(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <ChatHeader
        status={status}
        title={currentTitle}
        isCreatingSession={isCreatingSession}
        isRegeneratingTitle={isRegeneratingTitle}
        isSelectingMessages={skillSelectionMode != null}
        onCreateSession={() => {
          void handleCreateSession();
        }}
        onStartCreateSkill={() => beginSkillSelection('create')}
        onStartAdjustSkill={() => beginSkillSelection('adjust')}
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
            isSelectingMessages={skillSelectionMode != null}
            selectedMessageIds={selectedMessageIds}
            toolTimings={toolTimings}
            status={status}
            shouldShowPendingReply={shouldShowPendingReply}
            messagesEndRef={messagesEndRef}
            onSelectMessage={toggleSelectedMessage}
            onToggleExpanded={toggleExpanded}
          />
        </div>
      </div>

      {skillSelectionMode != null ? (
        <SkillSelectionPanel
          mode={skillSelectionMode}
          selectedCount={selectedMessageIds.length}
          skills={availableSkills}
          createName={createSkillName}
          createDescription={createSkillDescription}
          adjustSkillId={adjustSkillId}
          adjustPrompt={adjustPrompt}
          draftSkill={draftSkill}
          error={skillPanelError}
          message={skillPanelMessage}
          isGenerating={isGeneratingSkill}
          isSavingDraft={isSavingDraftSkill}
          onCreateNameChange={setCreateSkillName}
          onCreateDescriptionChange={setCreateSkillDescription}
          onAdjustSkillIdChange={setAdjustSkillId}
          onAdjustPromptChange={setAdjustPrompt}
          onDraftChange={setDraftSkill}
          onGenerate={() => {
            void generateSkillFromSelection();
          }}
          onSaveDraft={() => {
            void saveDraftSkill();
          }}
          onCancel={cancelSkillSelection}
        />
      ) : null}

      <div className="border-t border-border px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          {submitError != null ? (
            <p className="mb-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}
          <ChatComposer
            isLoading={isSubmitting}
            isUploadingFiles={isUploadingFiles}
            hasError={submitError != null}
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

function SkillSelectionPanel({
  mode,
  selectedCount,
  skills,
  createName,
  createDescription,
  adjustSkillId,
  adjustPrompt,
  draftSkill,
  error,
  message,
  isGenerating,
  isSavingDraft,
  onCreateNameChange,
  onCreateDescriptionChange,
  onAdjustSkillIdChange,
  onAdjustPromptChange,
  onDraftChange,
  onGenerate,
  onSaveDraft,
  onCancel,
}: {
  mode: SkillSelectionMode;
  selectedCount: number;
  skills: SkillView[];
  createName: string;
  createDescription: string;
  adjustSkillId: string;
  adjustPrompt: string;
  draftSkill: DraftSkillForm | null;
  error: string | null;
  message: string | null;
  isGenerating: boolean;
  isSavingDraft: boolean;
  onCreateNameChange: (value: string) => void;
  onCreateDescriptionChange: (value: string) => void;
  onAdjustSkillIdChange: (value: string) => void;
  onAdjustPromptChange: (value: string) => void;
  onDraftChange: (value: DraftSkillForm) => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="border-t border-border bg-muted/40 px-4 py-4 sm:px-6">
      <div className="mx-auto grid w-full max-w-4xl gap-4 border border-border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {mode === 'create' ? 'Create Skill From Chat' : 'Adjust Skill From Chat'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              已选择 {selectedCount} 条消息。API 只会使用这些消息作为生成上下文。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="border border-border px-3 py-2 text-sm transition hover:border-border-strong hover:bg-muted"
          >
            取消选择
          </button>
        </div>

        {mode === 'create' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={createName}
              onChange={event => onCreateNameChange(event.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
              placeholder="可选 name，例如 research-plan"
            />
            <input
              value={createDescription}
              onChange={event => onCreateDescriptionChange(event.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
              placeholder="可选 description"
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
            <select
              value={adjustSkillId}
              onChange={event => onAdjustSkillIdChange(event.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
            >
              {skills.map(skill => (
                <option key={skill.id} value={skill.id}>
                  /{skill.name}
                </option>
              ))}
            </select>
            <input
              value={adjustPrompt}
              onChange={event => onAdjustPromptChange(event.target.value)}
              className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
              placeholder="可选补充提示，例如：合并刚才的边界条件"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || selectedCount === 0 || (mode === 'adjust' && adjustSkillId.length === 0)}
            className="border border-border-strong bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? '生成中...' : mode === 'create' ? '生成 Skill 草案' : '生成调整草案'}
          </button>
          {draftSkill != null ? (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSavingDraft}
              className="border border-border px-3 py-2 text-sm transition hover:border-border-strong hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingDraft ? '保存中...' : '保存编辑结果'}
            </button>
          ) : null}
        </div>

        {error != null ? <p className="text-sm text-red-600">{error}</p> : null}
        {message != null ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {draftSkill != null ? (
          <div className="grid gap-3 border-t border-border pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={draftSkill.name}
                onChange={event =>
                  onDraftChange({ ...draftSkill, name: event.target.value })
                }
                className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
              />
              <input
                value={draftSkill.displayName}
                onChange={event =>
                  onDraftChange({ ...draftSkill, displayName: event.target.value })
                }
                className="border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
              />
            </div>
            <textarea
              value={draftSkill.description}
              onChange={event =>
                onDraftChange({ ...draftSkill, description: event.target.value })
              }
              className="min-h-20 border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition focus:border-border-strong"
            />
            <SkillEditor
              value={draftSkill.content}
              onChange={content => onDraftChange({ ...draftSkill, content })}
              disabled={isSavingDraft}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function skillToDraft(skill: SkillView): DraftSkillForm {
  return {
    id: skill.id,
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    content: skill.content,
  };
}

function upsertSkill(skills: SkillView[], skill: SkillView): SkillView[] {
  if (skills.some(item => item.id === skill.id)) {
    return skills.map(item => (item.id === skill.id ? skill : item));
  }

  return [skill, ...skills];
}

function isSkillPayload(value: unknown): value is { skill: SkillView } {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const skill = (value as Record<string, unknown>).skill;
  return isSkill(skill);
}

function isSkill(value: unknown): value is SkillView {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.displayName === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.content === 'string' &&
    (candidate.status === 'enabled' || candidate.status === 'disabled') &&
    (typeof candidate.sourceSessionId === 'string' || candidate.sourceSessionId == null) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

function isSessionPayload(value: unknown): value is { session: StoredChatSession } {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  return isStoredChatSession((value as Record<string, unknown>).session);
}

function isStoredChatSession(value: unknown): value is StoredChatSession {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.agentId === 'string' &&
    (typeof candidate.title === 'string' || candidate.title == null) &&
    Array.isArray(candidate.messages) &&
    isTurnState(candidate.turnState)
  );
}

function isTurnState(value: unknown): value is ChatSessionTurnState {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (candidate.status === 'idle' ||
      candidate.status === 'running' ||
      candidate.status === 'completed' ||
      candidate.status === 'failed') &&
    (typeof candidate.currentUserMessageId === 'string' ||
      candidate.currentUserMessageId == null) &&
    (typeof candidate.errorSummary === 'string' || candidate.errorSummary == null) &&
    (typeof candidate.updatedAt === 'string' || candidate.updatedAt == null)
  );
}

function readError(value: unknown, fallback: string): string {
  if (
    typeof value === 'object' &&
    value != null &&
    typeof (value as Record<string, unknown>).error === 'string'
  ) {
    return (value as { error: string }).error;
  }

  return fallback;
}
