import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  normalizeWorkspacePath,
  runDockerCommand,
  runSandboxCommand,
  SANDBOX_CONTAINER,
  toSandboxPath,
} from '@/lib/exec-sandbox';

export type WorkspaceFileType = 'file' | 'directory' | 'other';

export type WorkspaceFileItem = {
  name: string;
  path: string;
  type: WorkspaceFileType;
  size: number;
  modifiedAt: string;
};

export type WorkspaceListing = {
  path: string;
  parentPath: string | null;
  item: WorkspaceFileItem;
  children: WorkspaceFileItem[];
};

export type WorkspaceDownload = {
  filename: string;
  content: Buffer;
};

const LIST_SCRIPT = String.raw`
import json
import os
import sys

root = "/workspace"
rel = sys.argv[1]
target = os.path.normpath(os.path.join(root, rel))

if os.path.commonpath([root, target]) != root:
    raise SystemExit("path escapes workspace")

def relpath(value):
    result = os.path.relpath(value, root)
    return "" if result == "." else result

def item(value):
    stat = os.lstat(value)
    if os.path.isdir(value):
        kind = "directory"
    elif os.path.isfile(value):
        kind = "file"
    else:
        kind = "other"
    return {
        "name": os.path.basename(value) or "workspace",
        "path": relpath(value),
        "type": kind,
        "size": stat.st_size,
        "modifiedAt": stat.st_mtime,
    }

if not os.path.exists(target):
    raise SystemExit("not found")

current = item(target)
children = []

if os.path.isdir(target):
    for name in sorted(os.listdir(target), key=lambda value: value.lower()):
        children.append(item(os.path.join(target, name)))

print(json.dumps({"item": current, "children": children}))
`;

function toIsoTime(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return new Date(0).toISOString();
  }

  return new Date(value * 1000).toISOString();
}

function isRawWorkspaceItem(value: unknown): value is {
  name: string;
  path: string;
  type: WorkspaceFileType;
  size: number;
  modifiedAt: number;
} {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.name === 'string' &&
    typeof candidate.path === 'string' &&
    (candidate.type === 'file' ||
      candidate.type === 'directory' ||
      candidate.type === 'other') &&
    typeof candidate.size === 'number' &&
    typeof candidate.modifiedAt === 'number'
  );
}

function toWorkspaceItem(value: unknown): WorkspaceFileItem {
  if (!isRawWorkspaceItem(value)) {
    throw new Error('Invalid workspace item response.');
  }

  return {
    name: value.name,
    path: value.path,
    type: value.type,
    size: value.size,
    modifiedAt: toIsoTime(value.modifiedAt),
  };
}

function parseListing(value: string, requestedPath: string): WorkspaceListing {
  const payload = JSON.parse(value) as Record<string, unknown>;
  const item = toWorkspaceItem(payload.item);
  const rawChildren = Array.isArray(payload.children) ? payload.children : [];
  const parentPath = requestedPath.includes('/')
    ? requestedPath.split('/').slice(0, -1).join('/')
    : requestedPath.length > 0
      ? ''
      : null;

  return {
    path: requestedPath,
    parentPath,
    item,
    children: rawChildren.map(toWorkspaceItem),
  };
}

export async function listWorkspaceFiles(
  requestedPath: string | null | undefined,
): Promise<WorkspaceListing> {
  const workspacePath = normalizeWorkspacePath(requestedPath);

  const result = await runSandboxCommand([
    'python3',
    '-c',
    LIST_SCRIPT,
    workspacePath,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || '读取 workspace 失败');
  }

  return parseListing(result.stdout, workspacePath);
}

export async function uploadWorkspaceFile(
  directoryPath: string | null | undefined,
  file: File,
): Promise<WorkspaceFileItem> {
  const workspaceDirectory = normalizeWorkspacePath(directoryPath);
  const safeFilename = path.basename(file.name).trim();

  if (safeFilename.length === 0 || safeFilename === '.' || safeFilename === '..') {
    throw new Error('文件名无效');
  }

  const mkdir = await runSandboxCommand([
    'mkdir',
    '-p',
    toSandboxPath(workspaceDirectory),
  ]);

  if (mkdir.exitCode !== 0) {
    throw new Error(mkdir.stderr.trim() || '创建 workspace 目录失败');
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'workspace-upload-'));
  const tempFile = path.join(tempDirectory, `${randomUUID()}-${safeFilename}`);

  try {
    await writeFile(tempFile, Buffer.from(await file.arrayBuffer()));

    const copy = await runDockerCommand([
      'cp',
      tempFile,
      `${SANDBOX_CONTAINER}:${toSandboxPath(path.posix.join(workspaceDirectory, safeFilename))}`,
    ]);

    if (copy.exitCode !== 0) {
      throw new Error(copy.stderr.trim() || '上传文件到 workspace 失败');
    }

    const listing = await listWorkspaceFiles(
      path.posix.join(workspaceDirectory, safeFilename),
    );

    return listing.item;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

export async function downloadWorkspaceFile(
  requestedPath: string | null | undefined,
): Promise<WorkspaceDownload> {
  const workspacePath = normalizeWorkspacePath(requestedPath);

  if (workspacePath.length === 0) {
    throw new Error('请选择具体文件下载');
  }

  const listing = await listWorkspaceFiles(workspacePath);

  if (listing.item.type !== 'file') {
    throw new Error('仅支持下载文件');
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'workspace-download-'));
  const filename = path.basename(workspacePath);
  const localPath = path.join(tempDirectory, filename);

  try {
    const copy = await runDockerCommand([
      'cp',
      `${SANDBOX_CONTAINER}:${toSandboxPath(workspacePath)}`,
      localPath,
    ]);

    if (copy.exitCode !== 0) {
      throw new Error(copy.stderr.trim() || '从 workspace 下载文件失败');
    }

    return {
      filename,
      content: await readFile(localPath),
    };
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}
