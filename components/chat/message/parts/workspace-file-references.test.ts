import { describe, expect, it } from 'vitest';

import { extractWorkspacePaths } from './workspace-file-references';

describe('extractWorkspacePaths', () => {
  it('extracts unique workspace file paths from chat text', () => {
    expect(
      extractWorkspacePaths(
        '已生成 /workspace/out/result.png，可对照 `/workspace/out/data.json`。再次提到 /workspace/out/result.png',
      ),
    ).toEqual(['out/result.png', 'out/data.json']);
  });

  it('extracts paths after non-ascii punctuation', () => {
    expect(extractWorkspacePaths('文件已保存到：/workspace/out/result.png')).toEqual([
      'out/result.png',
    ]);
  });

  it('extracts paths from markdown links without swallowing link syntax', () => {
    expect(
      extractWorkspacePaths('[/workspace/out/result.png](/workspace/out/result.png)'),
    ).toEqual(['out/result.png']);
  });

  it('extracts workspace paths with spaces from markdown images', () => {
    expect(extractWorkspacePaths('![预览](/workspace/out/My Report.png)')).toEqual([
      'out/My Report.png',
    ]);
  });

  it('extracts workspace paths with spaces from inline code', () => {
    expect(extractWorkspacePaths('文件：`/workspace/out/My Report.md`')).toEqual([
      'out/My Report.md',
    ]);
  });

  it('extracts bare workspace paths with spaces', () => {
    expect(extractWorkspacePaths('文件：/workspace/out/My Report.md')).toEqual([
      'out/My Report.md',
    ]);
  });

  it('does not include trailing prose after a bare workspace path', () => {
    expect(extractWorkspacePaths('文件：/workspace/out/My Report.md 已生成')).toEqual([
      'out/My Report.md',
    ]);
  });

  it('decodes encoded workspace paths before returning them', () => {
    expect(extractWorkspacePaths('文件：/workspace/out/My%20Report.md')).toEqual([
      'out/My Report.md',
    ]);
  });

  it('ignores bare workspace root and non-workspace lookalikes', () => {
    expect(
      extractWorkspacePaths('目录 /workspace 已准备，备份在 /workspace-backup/file.txt。'),
    ).toEqual([]);
  });
});
