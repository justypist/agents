import { describe, expect, it } from 'vitest';

import { chatMarkdownUrlTransform } from './text-part';

const node = {} as Parameters<typeof chatMarkdownUrlTransform>[2];

describe('chatMarkdownUrlTransform', () => {
  it('routes workspace markdown links through the download endpoint', () => {
    expect(chatMarkdownUrlTransform('/workspace/out/result.png', 'href', node)).toBe(
      '/api/workspace/download?path=out%2Fresult.png',
    );
  });

  it('routes file workspace markdown links through the download endpoint', () => {
    expect(chatMarkdownUrlTransform('file:///workspace/tmp.sql', 'href', node)).toBe(
      '/api/workspace/download?path=tmp.sql',
    );
  });

  it('routes workspace markdown image sources through the inline endpoint', () => {
    expect(chatMarkdownUrlTransform('/workspace/out/result.png', 'src', node)).toBe(
      '/api/workspace/download?path=out%2Fresult.png&disposition=inline',
    );
  });

  it('decodes encoded workspace paths before routing them', () => {
    expect(chatMarkdownUrlTransform('/workspace/out/My%20Report.md', 'href', node)).toBe(
      '/api/workspace/download?path=out%2FMy%20Report.md',
    );
  });
});
