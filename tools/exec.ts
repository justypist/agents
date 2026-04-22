import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { jsonSchema, tool } from 'ai';

const WORKSPACE_ROOT = process.cwd();
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 12_000;
const SHELL_CANDIDATES = [
  process.env.SHELL,
  '/bin/bash',
  '/usr/bin/bash',
  '/bin/sh',
  '/usr/bin/sh',
];

type execInput = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
};

type execResult = {
  command: string;
  cwd: string;
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
      description: '命令工作目录，默认为仓库根目录，且必须位于当前 workspace 内',
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

function resolveWorkingDirectory(cwd?: string): string {
  if (cwd == null || cwd.trim().length === 0) {
    return WORKSPACE_ROOT;
  }

  const resolvedDirectory = path.resolve(WORKSPACE_ROOT, cwd);
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedDirectory);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('cwd 必须位于当前 workspace 内');
  }

  return resolvedDirectory;
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

function resolveShell(): string {
  for (const candidate of SHELL_CANDIDATES) {
    if (candidate == null || candidate.trim().length === 0) {
      continue;
    }

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('未找到可用 shell，请确认系统存在 /bin/sh 或配置 SHELL 环境变量');
}

export const exec = tool({
  description:
    '在当前 workspace 内执行本地 shell 命令，适合读写文件、运行构建、调用 CLI；仅在确有必要时使用',
  inputSchema: execInputSchema,
  execute: async input => {
    const command = normalizeCommand(input.command);
    const cwd = resolveWorkingDirectory(input.cwd);
    const timeoutMs = normalizeTimeout(input.timeoutMs);
    const shell = resolveShell();

    return await new Promise<execResult>((resolve, reject) => {
      const child = spawn(shell, ['-c', command], {
        cwd,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout.on('data', chunk => {
        stdout += String(chunk);
      });

      child.stderr.on('data', chunk => {
        stderr += String(chunk);
      });

      child.on('error', error => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on('close', (exitCode, signal) => {
        clearTimeout(timeout);
        resolve({
          command,
          cwd,
          exitCode,
          signal,
          timedOut,
          stdout: truncateOutput(stdout),
          stderr: truncateOutput(stderr),
        });
      });
    });
  },
});
