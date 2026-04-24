import { spawn } from 'node:child_process';
import path from 'node:path';

import { config } from '@/config';

export const SANDBOX_WORKSPACE = '/workspace';
export const SANDBOX_CONTAINER = config.execSandbox.container;
export const SANDBOX_IMAGE = config.execSandbox.image;
export const SANDBOX_NETWORK = config.execSandbox.network;
export const SANDBOX_WORKSPACE_VOLUME = config.execSandbox.workspaceVolume;
export const SANDBOX_HOME_VOLUME = config.execSandbox.homeVolume;

export type CommandResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type SandboxCommandOptions = {
  cwd?: string;
  timeoutMs?: number;
};

export async function runDockerCommand(
  args: string[],
  timeoutMs = 30_000,
): Promise<CommandResult> {
  return await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn('docker', args, {
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
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
  });
}

async function ensureDockerImage(): Promise<void> {
  const inspect = await runDockerCommand(['image', 'inspect', SANDBOX_IMAGE]);

  if (inspect.exitCode === 0) {
    return;
  }

  throw new Error(
    `未找到 exec 沙箱镜像 ${SANDBOX_IMAGE}，请先运行 docker compose -f compose.build.yaml build exec-sandbox`,
  );
}

async function dockerContainerExists(): Promise<boolean> {
  const inspect = await runDockerCommand([
    'container',
    'inspect',
    SANDBOX_CONTAINER,
  ]);

  return inspect.exitCode === 0;
}

async function dockerContainerRunning(): Promise<boolean> {
  const inspect = await runDockerCommand([
    'container',
    'inspect',
    '--format',
    '{{.State.Running}}',
    SANDBOX_CONTAINER,
  ]);

  return inspect.exitCode === 0 && inspect.stdout.trim() === 'true';
}

async function createSandboxContainer(): Promise<void> {
  await ensureDockerImage();

  const create = await runDockerCommand([
    'create',
    '--name',
    SANDBOX_CONTAINER,
    '--network',
    SANDBOX_NETWORK,
    '--volume',
    `${SANDBOX_WORKSPACE_VOLUME}:${SANDBOX_WORKSPACE}`,
    '--volume',
    `${SANDBOX_HOME_VOLUME}:/home/agent`,
    '--workdir',
    SANDBOX_WORKSPACE,
    SANDBOX_IMAGE,
    'sleep',
    'infinity',
  ]);

  if (create.exitCode !== 0) {
    throw new Error(
      `无法创建 exec 沙箱容器 ${SANDBOX_CONTAINER}: ${create.stderr || create.stdout}`,
    );
  }
}

export async function ensureSandboxContainer(): Promise<void> {
  if (!(await dockerContainerExists())) {
    await createSandboxContainer();
  }

  if (await dockerContainerRunning()) {
    return;
  }

  const start = await runDockerCommand(['start', SANDBOX_CONTAINER]);

  if (start.exitCode !== 0) {
    throw new Error(
      `无法启动 exec 沙箱容器 ${SANDBOX_CONTAINER}: ${start.stderr || start.stdout}`,
    );
  }
}

export async function runSandboxCommand(
  args: string[],
  options: SandboxCommandOptions = {},
): Promise<CommandResult> {
  const cwd = options.cwd ?? SANDBOX_WORKSPACE;

  if (cwd !== SANDBOX_WORKSPACE && !cwd.startsWith(`${SANDBOX_WORKSPACE}/`)) {
    throw new Error('sandbox cwd 必须位于 /workspace 内');
  }

  await ensureSandboxContainer();

  return await runDockerCommand(
    ['exec', '--workdir', cwd, SANDBOX_CONTAINER, ...args],
    options.timeoutMs,
  );
}

export function toSandboxPath(relativePath: string): string {
  if (relativePath.length === 0) {
    return SANDBOX_WORKSPACE;
  }

  return path.posix.join(SANDBOX_WORKSPACE, relativePath);
}

export function normalizeWorkspacePath(value: string | null | undefined): string {
  const rawPath = value?.trim() || '';
  const withoutWorkspaceRoot =
    rawPath === SANDBOX_WORKSPACE || rawPath.startsWith(`${SANDBOX_WORKSPACE}/`)
      ? rawPath.slice(SANDBOX_WORKSPACE.length)
      : rawPath;
  const withoutRoot = withoutWorkspaceRoot.replace(/^\/+/, '');
  const normalized = path.posix.normalize(withoutRoot);

  if (normalized === '.') {
    return '';
  }

  if (normalized.startsWith('../') || normalized === '..') {
    throw new Error('workspace path 必须位于 /workspace 内');
  }

  return normalized;
}
