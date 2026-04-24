import { jsonSchema, tool } from 'ai';

import {
  normalizeWorkspacePath,
  runSandboxCommand,
  SANDBOX_CONTAINER,
  SANDBOX_IMAGE,
  SANDBOX_NETWORK,
  toSandboxPath,
} from '@/lib/exec-sandbox';

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
  sandbox: {
    container: string;
    image: string;
    cwd: string;
    network: string;
  };
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

function resolveSandboxWorkingDirectory(cwd?: string): string {
  return toSandboxPath(normalizeWorkspacePath(cwd));
}

export const exec = tool({
  description:
    '在持久 Docker 沙箱内执行 shell 命令，适合读写文件、安装依赖、运行构建、调用 CLI；不会直接在应用容器或宿主机执行',
  inputSchema: execInputSchema,
  execute: async input => {
    const command = normalizeCommand(input.command);
    const sandboxCwd = resolveSandboxWorkingDirectory(input.cwd);
    const timeoutMs = normalizeTimeout(input.timeoutMs);
    const timeoutSeconds = String(Math.max(1, Math.ceil(timeoutMs / 1_000)));

    const result = await runSandboxCommand(
      [
        'timeout',
        '--kill-after=2s',
        `${timeoutSeconds}s`,
        'bash',
        '-lc',
        command,
      ],
      { cwd: sandboxCwd, timeoutMs: timeoutMs + 5_000 },
    );

    return {
      command,
      cwd: sandboxCwd,
      sandbox: {
        container: SANDBOX_CONTAINER,
        image: SANDBOX_IMAGE,
        cwd: sandboxCwd,
        network: SANDBOX_NETWORK,
      },
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut || result.exitCode === 124,
      stdout: truncateOutput(result.stdout),
      stderr: truncateOutput(result.stderr),
    } satisfies execResult;
  },
});
