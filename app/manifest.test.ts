/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import manifest from './manifest';

describe('manifest', () => {
  it('describes the installable PWA shell', () => {
    expect(manifest()).toEqual({
      name: 'Agents',
      short_name: 'Agents',
      description: 'Agents Web 应用，支持安装为独立 PWA。',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#fafafa',
      theme_color: '#111111',
      icons: [
        {
          src: '/api/pwa-icon/192',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/api/pwa-icon/512',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/api/pwa-icon/180',
          sizes: '180x180',
          type: 'image/png',
        },
      ],
    });
  });
});
