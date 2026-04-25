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
    '在当前运行环境的持久 /workspace 中执行 shell 命令；不是安全沙箱，适合受信任场景下读写文件、安装依赖、运行构建、调用 CLI',
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
