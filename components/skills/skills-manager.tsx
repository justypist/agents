'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { SkillEditor } from '@/components/skills/skill-editor';
import type { SkillStatus, SkillView } from '@/components/skills/types';

type SkillsManagerProps = {
  initialSkills: SkillView[];
};

type SkillFormState = {
  id: string | null;
  name: string;
  displayName: string;
  description: string;
  content: string;
  status: SkillStatus;
};

const emptyForm: SkillFormState = {
  id: null,
  name: '',
  displayName: '',
  description: '',
  content: '',
  status: 'disabled',
};

export function SkillsManager({ initialSkills }: SkillsManagerProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [form, setForm] = useState<SkillFormState>(() =>
    initialSkills[0] == null ? emptyForm : skillToForm(initialSkills[0]),
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedSkill = form.id == null ? null : skills.find(skill => skill.id === form.id);

  const startCreate = (): void => {
    setForm(emptyForm);
    setError(null);
    setStatusMessage(null);
  };

  const selectSkill = (skill: SkillView): void => {
    setForm(skillToForm(skill));
    setError(null);
    setStatusMessage(null);
  };

  const saveSkill = async (): Promise<void> => {
    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const isCreating = form.id == null;
      const response = await fetch(isCreating ? '/api/skills' : `/api/skills/${form.id}`, {
        method: isCreating ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          displayName: form.displayName,
          description: form.description,
          content: form.content,
          status: form.status,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readError(payload, '保存 skill 失败'));
      }

      if (!isSkillPayload(payload)) {
        throw new Error('skill 响应格式无效');
      }

      const nextSkill = payload.skill;
      setSkills(previousSkills =>
        isCreating
          ? [nextSkill, ...previousSkills]
          : previousSkills.map(skill =>
              skill.id === nextSkill.id ? nextSkill : skill,
            ),
      );
      setForm(skillToForm(nextSkill));
      setStatusMessage(isCreating ? 'Skill 已创建，默认保持停用' : 'Skill 已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存 skill 失败');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (): Promise<void> => {
    if (form.id == null) {
      setForm(previous => ({
        ...previous,
        status: previous.status === 'enabled' ? 'disabled' : 'enabled',
      }));
      return;
    }

    const nextStatus: SkillStatus = form.status === 'enabled' ? 'disabled' : 'enabled';
    setIsSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/skills/${form.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readError(payload, '更新 skill 状态失败'));
      }

      if (!isSkillPayload(payload)) {
        throw new Error('skill 响应格式无效');
      }

      const nextSkill = payload.skill;
      setSkills(previousSkills =>
        previousSkills.map(skill => (skill.id === nextSkill.id ? nextSkill : skill)),
      );
      setForm(skillToForm(nextSkill));
      setStatusMessage(nextStatus === 'enabled' ? 'Skill 已启用' : 'Skill 已停用');
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : '更新 skill 状态失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header className="border-b border-border pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link
                href="/"
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                ← 返回 agents
              </Link>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Database Skills
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Skills 控制台
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                管理保存在数据库中的可复用 skill。新建和 AI 生成的 skill 默认停用，确认后再启用参与聊天调用。
              </p>
            </div>
            <button
              type="button"
              onClick={startCreate}
              className="border border-border-strong bg-foreground px-4 py-2 text-sm text-background transition hover:opacity-85"
            >
              新建 Skill
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="border border-border">
            <div className="border-b border-border bg-muted px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Skill 列表
            </div>
            {skills.length === 0 ? (
              <div className="px-4 py-10 text-sm leading-6 text-muted-foreground">
                当前还没有 skill。点击“新建 Skill”沉淀一个可复用流程。
              </div>
            ) : (
              <div className="divide-y divide-border">
                {skills.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => selectSkill(skill)}
                    className={`block w-full px-4 py-4 text-left transition hover:bg-muted/60 ${
                      skill.id === form.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{skill.displayName}</p>
                      <StatusPill status={skill.status} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      /{skill.name}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      {skill.description}
                    </p>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      更新于 {formatTime(skill.updatedAt)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="border border-border">
            <div className="flex flex-col gap-3 border-b border-border bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {form.id == null ? 'Create' : 'Edit'} Skill
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedSkill == null
                    ? '保存后将写入数据库并默认停用。'
                    : `正在编辑 /${selectedSkill.name}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void toggleStatus();
                  }}
                  disabled={isSaving}
                  className="border border-border px-3 py-2 text-sm transition hover:border-border-strong hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {form.status === 'enabled' ? '停用' : '启用'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void saveSkill();
                  }}
                  disabled={isSaving}
                  className="border border-border-strong bg-foreground px-3 py-2 text-sm text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-4">
              {error != null ? (
                <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              {statusMessage != null ? (
                <div className="border border-border-strong bg-muted px-4 py-3 text-sm">
                  {statusMessage}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" hint="lowercase kebab-case，用于 /{name} 调用">
                  <input
                    value={form.name}
                    onChange={event =>
                      setForm(previous => ({ ...previous, name: event.target.value }))
                    }
                    className="w-full border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
                    placeholder="research-plan"
                  />
                </Field>
                <Field label="Display Name" hint="管理页展示标题">
                  <input
                    value={form.displayName}
                    onChange={event =>
                      setForm(previous => ({
                        ...previous,
                        displayName: event.target.value,
                      }))
                    }
                    className="w-full border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-border-strong"
                    placeholder="Research Plan"
                  />
                </Field>
              </div>

              <Field label="Description" hint="用于列表、检索和 agent 判断是否适用">
                <textarea
                  value={form.description}
                  onChange={event =>
                    setForm(previous => ({
                      ...previous,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition focus:border-border-strong"
                  placeholder="说明这个 skill 适合处理什么任务。"
                />
              </Field>

              <Field label="Content" hint="正文可自由编辑；选中文本后可调用 AI 改写">
                <SkillEditor
                  value={form.content}
                  onChange={content =>
                    setForm(previous => ({ ...previous, content }))
                  }
                  disabled={isSaving}
                />
              </Field>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: SkillStatus }) {
  return (
    <span className="border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase text-muted-foreground">
      {status}
    </span>
  );
}

function skillToForm(skill: SkillView): SkillFormState {
  return {
    id: skill.id,
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    content: skill.content,
    status: skill.status,
  };
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

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
