import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

import {
  ensureWorkspaceRoot,
  normalizeWorkspacePath,
  toWorkspacePath,
  WORKSPACE_ROOT,
} from '@/lib/exec-runtime';

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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isInsidePath(root: string, value: string): boolean {
  const relativePath = path.relative(root, value);

  return relativePath === '' || (
    !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
  );
}

async function getWorkspaceRealPath(): Promise<string> {
  await ensureWorkspaceRoot();

  return await realpath(WORKSPACE_ROOT);
}

async function assertExistingWorkspacePath(absolutePath: string): Promise<void> {
  const workspaceRealPath = await getWorkspaceRealPath();
  const targetRealPath = await realpath(absolutePath);

  if (!isInsidePath(workspaceRealPath, targetRealPath)) {
    throw new Error('workspace path 必须位于 /workspace 内');
  }
}

async function assertCreatableWorkspacePath(absolutePath: string): Promise<void> {
  const workspaceRealPath = await getWorkspaceRealPath();
  let currentPath = absolutePath;

  while (true) {
    try {
      const targetRealPath = await realpath(currentPath);

      if (!isInsidePath(workspaceRealPath, targetRealPath)) {
        throw new Error('workspace path 必须位于 /workspace 内');
      }

      return;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }

      const parentPath = path.dirname(currentPath);

      if (parentPath === currentPath) {
        throw error;
      }

      currentPath = parentPath;
    }
  }
}

async function writeWorkspaceFile(absolutePath: string, content: Buffer): Promise<void> {
  const existingStat = await lstat(absolutePath).catch((error: unknown) => {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (existingStat?.isSymbolicLink()) {
    throw new Error('workspace path 不能是符号链接');
  }

  const file = await open(
    absolutePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
  );

  try {
    await file.writeFile(content);
  } finally {
    await file.close();
  }
}

async function readWorkspaceFile(absolutePath: string): Promise<Buffer> {
  const file = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);

  try {
    return await file.readFile();
  } finally {
    await file.close();
  }
}

async function toWorkspaceItem(value: string, workspacePath: string): Promise<WorkspaceFileItem> {
  const stat = await lstat(value);
  const type: WorkspaceFileType = stat.isDirectory()
    ? 'directory'
    : stat.isFile()
      ? 'file'
      : 'other';

  return {
    name: path.basename(value) || 'workspace',
    path: workspacePath,
    type,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function getParentPath(requestedPath: string): string | null {
  const parentPath = requestedPath.includes('/')
    ? requestedPath.split('/').slice(0, -1).join('/')
    : requestedPath.length > 0
      ? ''
      : null;

  return parentPath;
}

export async function listWorkspaceFiles(
  requestedPath: string | null | undefined,
): Promise<WorkspaceListing> {
  const workspacePath = normalizeWorkspacePath(requestedPath);
  const absolutePath = toWorkspacePath(workspacePath);

  await assertExistingWorkspacePath(absolutePath);

  const item = await toWorkspaceItem(absolutePath, workspacePath);
  const children = item.type === 'directory'
    ? await Promise.all(
        (await readdir(absolutePath))
          .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
          .map(childName => {
            const childWorkspacePath = path.posix.join(workspacePath, childName);
            return toWorkspaceItem(
              toWorkspacePath(childWorkspacePath),
              childWorkspacePath,
            );
          }),
      )
    : [];

  return {
    path: workspacePath,
    parentPath: getParentPath(workspacePath),
    item,
    children,
  };
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

  const absoluteDirectory = toWorkspacePath(workspaceDirectory);
  await assertCreatableWorkspacePath(absoluteDirectory);
  await mkdir(absoluteDirectory, { recursive: true });
  await assertExistingWorkspacePath(absoluteDirectory);

  const targetWorkspacePath = path.posix.join(workspaceDirectory, safeFilename);
  const absoluteTargetPath = toWorkspacePath(targetWorkspacePath);
  await assertCreatableWorkspacePath(path.dirname(absoluteTargetPath));
  await writeWorkspaceFile(absoluteTargetPath, Buffer.from(await file.arrayBuffer()));

  const listing = await listWorkspaceFiles(targetWorkspacePath);

  return listing.item;
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

  const filename = path.basename(workspacePath);

  return {
    filename,
    content: await readWorkspaceFile(toWorkspacePath(workspacePath)),
  };
}
