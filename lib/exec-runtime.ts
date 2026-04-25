import { spawn } from 'node:child_process';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { config } from '@/config';

export const VIRTUAL_WORKSPACE = '/workspace';
export const WORKSPACE_ROOT = path.resolve(config.exec.workspacePath);

const FORCE_KILL_AFTER_MS = 2_000;
const VIRTUAL_WORKSPACE_REFERENCE_PATTERN = /\/workspace(?=$|[\/\s"'`;&|<>()])/g;

export type CommandResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type LocalCommandOptions = {
  cwd?: string;
  timeoutMs?: number;
};

type ShellCommand = {
  command: string;
  args: string[];
};

type KillableChildProcess = {
  pid?: number;
  kill(signal: NodeJS.Signals): boolean;
};

export async function ensureWorkspaceRoot(): Promise<void> {
  await mkdir(WORKSPACE_ROOT, { recursive: true });
}

function assertWorkspacePath(value: string): void {
  const resolved = path.resolve(value);

  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(`${WORKSPACE_ROOT}${path.sep}`)) {
    throw new Error('workspace path 必须位于 /workspace 内');
  }
}

async function fileExists(value: string): Promise<boolean> {
  try {
    await access(value);
    return true;
  } catch {
    return false;
  }
}

async function resolveShell(command: string): Promise<ShellCommand> {
  for (const candidate of ['/bin/bash', '/usr/bin/bash']) {
    if (await fileExists(candidate)) {
      return { command: candidate, args: ['-lc', command] };
    }
  }

  for (const candidate of ['/bin/sh', '/usr/bin/sh']) {
    if (await fileExists(candidate)) {
      return { command: candidate, args: ['-c', command] };
    }
  }

  return { command: 'sh', args: ['-c', command] };
}

function isInsideWorkspace(value: string): boolean {
  const resolved = path.resolve(value);

  return resolved === WORKSPACE_ROOT || resolved.startsWith(`${WORKSPACE_ROOT}${path.sep}`);
}

function toPosixRelativePath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

export function mapVirtualWorkspaceReferences(value: string): string {
  if (WORKSPACE_ROOT === VIRTUAL_WORKSPACE) {
    return value;
  }

  const workspaceRootPlaceholder = '\0WORKSPACE_ROOT\0';

  return value
    .split(WORKSPACE_ROOT)
    .join(workspaceRootPlaceholder)
    .replace(VIRTUAL_WORKSPACE_REFERENCE_PATTERN, WORKSPACE_ROOT)
    .split(workspaceRootPlaceholder)
    .join(WORKSPACE_ROOT);
}

function stopChildProcess(child: KillableChildProcess, signal: NodeJS.Signals): void {
  if (child.pid == null) {
    return;
  }

  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code === 'ESRCH') {
        return;
      }
    }
  }

  child.kill(signal);
}

export function virtualizeWorkspaceText(value: string): string {
  if (WORKSPACE_ROOT === VIRTUAL_WORKSPACE) {
    return value;
  }

  return value.split(WORKSPACE_ROOT).join(VIRTUAL_WORKSPACE);
}

export async function runLocalCommand(
  command: string,
  args: string[],
  options: LocalCommandOptions = {},
): Promise<CommandResult> {
  const cwd = options.cwd ?? WORKSPACE_ROOT;
  assertWorkspacePath(cwd);
  await ensureWorkspaceRoot();

  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let timeout: NodeJS.Timeout | null = null;
    let forceKillTimeout: NodeJS.Timeout | null = null;

    const clearTimers = () => {
      if (timeout != null) {
        clearTimeout(timeout);
      }

      if (forceKillTimeout != null) {
        clearTimeout(forceKillTimeout);
      }
    };

    if (options.timeoutMs != null) {
      timeout = setTimeout(() => {
        timedOut = true;
        stopChildProcess(child, 'SIGTERM');
        forceKillTimeout = setTimeout(() => {
          stopChildProcess(child, 'SIGKILL');
        }, FORCE_KILL_AFTER_MS);
      }, options.timeoutMs);
    }

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });

    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    child.on('error', error => {
      clearTimers();

      reject(error);
    });

    child.on('close', (exitCode, signal) => {
      clearTimers();

      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
  });
}

export async function runLocalShellCommand(
  command: string,
  options: LocalCommandOptions = {},
): Promise<CommandResult> {
  const shell = await resolveShell(command);

  return await runLocalCommand(shell.command, shell.args, options);
}

export function toWorkspacePath(relativePath: string): string {
  const target = relativePath.length === 0
    ? WORKSPACE_ROOT
    : path.resolve(WORKSPACE_ROOT, relativePath);

  assertWorkspacePath(target);

  return target;
}

export function toVirtualWorkspacePath(relativePath: string): string {
  if (relativePath.length === 0) {
    return VIRTUAL_WORKSPACE;
  }

  return path.posix.join(VIRTUAL_WORKSPACE, relativePath);
}

export function normalizeWorkspacePath(value: string | null | undefined): string {
  const rawPath = value?.trim() || '';

  if (rawPath.length === 0) {
    return '';
  }

  if (rawPath === VIRTUAL_WORKSPACE || rawPath.startsWith(`${VIRTUAL_WORKSPACE}/`)) {
    const normalizedVirtualPath = path.posix.normalize(
      rawPath.slice(VIRTUAL_WORKSPACE.length).replace(/^\/+/, ''),
    );

    if (normalizedVirtualPath === '.') {
      return '';
    }

    if (normalizedVirtualPath.startsWith('../') || normalizedVirtualPath === '..') {
      throw new Error('workspace path 必须位于 /workspace 内');
    }

    return normalizedVirtualPath;
  }

  if (path.isAbsolute(rawPath)) {
    if (!isInsideWorkspace(rawPath)) {
      throw new Error('workspace path 必须位于 /workspace 内');
    }

    return toPosixRelativePath(path.relative(WORKSPACE_ROOT, rawPath));
  }

  const normalized = path.posix.normalize(rawPath);

  if (normalized === '.') {
    return '';
  }

  if (normalized.startsWith('../') || normalized === '..') {
    throw new Error('workspace path 必须位于 /workspace 内');
  }

  return normalized;
}
