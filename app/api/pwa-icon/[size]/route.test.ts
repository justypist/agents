/** @vitest-environment node */

import { describe, expect, it, vi } from 'vitest';

import { dynamic, GET } from './route';

vi.mock('next/og', () => ({
  ImageResponse: class extends Response {
    constructor(_element: unknown, init: { width: number; height: number }) {
      super(JSON.stringify(init), {
        headers: {
          'content-type': 'image/png',
        },
      });
    }
  },
}));

describe('GET /api/pwa-icon/[size]', () => {
  it('is statically generated', () => {
    expect(dynamic).toBe('force-static');
  });

  it('returns generated icons for supported sizes', async () => {
    const response = await GET(new Request('http://localhost/api/pwa-icon/192'), {
      params: Promise.resolve({ size: '192' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    await expect(response.json()).resolves.toEqual({ width: 192, height: 192 });
  });

  it('returns 404 for unsupported sizes', async () => {
    const response = await GET(new Request('http://localhost/api/pwa-icon/128'), {
      params: Promise.resolve({ size: '128' }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Not found');
  });
});
