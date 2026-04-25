import { describe, expect, it } from 'vitest';

import {
  getWorkspaceFileContentType,
  getWorkspacePreviewKind,
  isTextMediaType,
} from '@/lib/workspace-preview';

describe('workspace preview helpers', () => {
  it('detects inline image and text content types', () => {
    expect(getWorkspaceFileContentType('chart.png')).toBe('image/png');
    expect(getWorkspaceFileContentType('/workspace/report.md')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(getWorkspaceFileContentType('/workspace/Dockerfile')).toBe(
      'text/plain; charset=utf-8',
    );
    expect(getWorkspaceFileContentType('archive.zip')).toBeNull();
  });

  it('classifies previewable workspace files', () => {
    expect(getWorkspacePreviewKind('photo.webp')).toBe('image');
    expect(getWorkspacePreviewKind('.env')).toBe('text');
    expect(getWorkspacePreviewKind('build.tar.gz')).toBeNull();
  });

  it('recognizes structured text media types', () => {
    expect(isTextMediaType('text/plain')).toBe(true);
    expect(isTextMediaType('application/json')).toBe(true);
    expect(isTextMediaType('application/vnd.api+json')).toBe(true);
    expect(isTextMediaType('application/octet-stream')).toBe(false);
  });
});
