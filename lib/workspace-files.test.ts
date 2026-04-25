import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { WORKSPACE_ROOT } from '@/lib/exec-runtime';
import { downloadWorkspaceFile, uploadWorkspaceFile } from '@/lib/workspace-files';

const testId = randomUUID();
const workspaceTestRoot = path.join(WORKSPACE_ROOT, `workspace-files-test-${testId}`);
const outsideTestRoot = path.join(process.cwd(), '.data', `workspace-files-outside-${testId}`);

async function cleanup(): Promise<void> {
  await rm(workspaceTestRoot, { force: true, recursive: true });
  await rm(outsideTestRoot, { force: true, recursive: true });
}

describe('workspace files', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('rejects uploads through directory symlinks that escape the workspace', async () => {
    await cleanup();
    await mkdir(workspaceTestRoot, { recursive: true });
    await mkdir(outsideTestRoot, { recursive: true });
    await symlink(outsideTestRoot, path.join(workspaceTestRoot, 'link'), 'dir');

    await expect(
      uploadWorkspaceFile(
        path.posix.join(path.basename(workspaceTestRoot), 'link'),
        new File(['owned'], 'owned.txt'),
      ),
    ).rejects.toThrow('workspace path 必须位于 /workspace 内');

    await expect(readFile(path.join(outsideTestRoot, 'owned.txt'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects downloads through directory symlinks that escape the workspace', async () => {
    await cleanup();
    await mkdir(workspaceTestRoot, { recursive: true });
    await mkdir(outsideTestRoot, { recursive: true });
    await writeFile(path.join(outsideTestRoot, 'secret.txt'), 'secret');
    await symlink(outsideTestRoot, path.join(workspaceTestRoot, 'link'), 'dir');

    await expect(
      downloadWorkspaceFile(
        path.posix.join(path.basename(workspaceTestRoot), 'link', 'secret.txt'),
      ),
    ).rejects.toThrow('workspace path 必须位于 /workspace 内');
  });
});
