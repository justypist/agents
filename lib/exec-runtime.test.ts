import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  mapVirtualWorkspaceReferences,
  normalizeWorkspacePath,
  runLocalShellCommand,
  virtualizeWorkspaceText,
  VIRTUAL_WORKSPACE,
  WORKSPACE_ROOT,
} from '@/lib/exec-runtime';

describe('exec runtime workspace paths', () => {
  it('normalizes virtual workspace paths', () => {
    expect(normalizeWorkspacePath(VIRTUAL_WORKSPACE)).toBe('');
    expect(normalizeWorkspacePath(`${VIRTUAL_WORKSPACE}/foo/bar`)).toBe('foo/bar');
  });

  it('normalizes actual workspace paths', () => {
    expect(normalizeWorkspacePath(WORKSPACE_ROOT)).toBe('');
    expect(normalizeWorkspacePath(path.join(WORKSPACE_ROOT, 'foo', 'bar'))).toBe(
      'foo/bar',
    );
  });

  it('rejects absolute paths outside the workspace', () => {
    expect(() => normalizeWorkspacePath('/tmp/outside-workspace')).toThrow(
      'workspace path 必须位于 /workspace 内',
    );
  });

  it('maps virtual references in commands without remapping actual paths', () => {
    const command = `find ${VIRTUAL_WORKSPACE} && cat ${WORKSPACE_ROOT}/tmp.sql`;
    const mapped = mapVirtualWorkspaceReferences(command);

    expect(mapped).toContain(`find ${WORKSPACE_ROOT}`);
    expect(mapped).toContain(`cat ${WORKSPACE_ROOT}/tmp.sql`);
    expect(mapped).not.toContain(`${WORKSPACE_ROOT}${WORKSPACE_ROOT}`);
  });

  it('only maps virtual workspace references on path boundaries', () => {
    const command = 'cat /workspace/file /workspace-backup /workspace.old "/workspace"';
    const mapped = mapVirtualWorkspaceReferences(command);

    expect(mapped).toContain(`cat ${WORKSPACE_ROOT}/file`);
    expect(mapped).toContain('/workspace-backup');
    expect(mapped).toContain('/workspace.old');
    expect(mapped).toContain(`"${WORKSPACE_ROOT}"`);
  });

  it('virtualizes actual workspace paths in command output', () => {
    expect(virtualizeWorkspaceText(`${WORKSPACE_ROOT}/tmp.sql`)).toBe(
      `${VIRTUAL_WORKSPACE}/tmp.sql`,
    );
  });

  it('force kills commands that ignore SIGTERM on timeout', async () => {
    const startedAt = Date.now();
    const result = await runLocalShellCommand("trap '' TERM; sleep 10", {
      timeoutMs: 100,
    });

    expect(result.timedOut).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  });
});
