import { jsonSchema, tool } from 'ai';

import {
  mapVirtualWorkspaceReferences,
  normalizeWorkspacePath,
  runLocalShellCommand,
  toVirtualWorkspacePath,
  toWorkspacePath,
  virtualizeWorkspaceText,
} from '@/lib/exec-runtime';

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 12_000;

type execInput = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
};

type execResult = {
  command: string;
  cwd: string;
  workspace: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
};

const execInputSchema = jsonSchema<execInput>({
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: '要执行的 shell 命令',
    },
    cwd: {
      type: 'string',
      description: '命令工作目录，默认为 /workspace，可传相对路径或 /workspace 下绝对路径',
    },
    timeoutMs: {
      type: 'integer',
      description: `超时时间，默认 ${DEFAULT_TIMEOUT_MS}ms，最大 ${MAX_TIMEOUT_MS}ms`,
      minimum: 1_000,
      maximum: MAX_TIMEOUT_MS,
    },
  },
  required: ['command'],
  additionalProperties: false,
});

function truncateOutput(value: string): string {
  if (value.length <= MAX_OUTPUT_CHARS) {
    return value;
  }

  return `${value.slice(0, MAX_OUTPUT_CHARS)}\n...[truncated]`;
}

function normalizeCommand(command: string): string {
  const normalizedCommand = command.trim();

  if (normalizedCommand.length === 0) {
    throw new Error('command 不能为空');
  }

  return normalizedCommand;
}

function normalizeTimeout(timeoutMs?: number): number {
  if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(Math.floor(timeoutMs), 1_000), MAX_TIMEOUT_MS);
}

function resolveWorkingDirectory(cwd?: string): string {
  return toWorkspacePath(normalizeWorkspacePath(cwd));
}

export const exec = tool({
  description:
    '在持久 /workspace 中执行 shell 命令；适合需要查看或生成文件、运行构建、测试、脚本、CLI 的受信任场景。调用前先明确目的，将命令限制在当前任务所需的最小范围，避免危险、无关或不可逆操作；不要删除未知文件、批量改写无关内容，除非用户明确要求。返回内容会映射为 /workspace 虚拟路径；回复中提到 workspace 文件时使用 /workspace/...，列目录、生成文件、提供预览或下载时直接输出裸路径，不要使用 file://、本机绝对路径或 Markdown 链接包装',
  inputSchema: execInputSchema,
  execute: async input => {
    const command = normalizeCommand(input.command);
    const cwd = resolveWorkingDirectory(input.cwd);
    const workspacePath = normalizeWorkspacePath(input.cwd);
    const timeoutMs = normalizeTimeout(input.timeoutMs);

    const result = await runLocalShellCommand(mapVirtualWorkspaceReferences(command), {
      cwd,
      timeoutMs,
    });

    return {
      command,
      cwd: toVirtualWorkspacePath(workspacePath),
      workspace: '/workspace',
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      stdout: truncateOutput(virtualizeWorkspaceText(result.stdout)),
      stderr: truncateOutput(virtualizeWorkspaceText(result.stderr)),
    } satisfies execResult;
  },
});
