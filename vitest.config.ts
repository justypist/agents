import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const serverOnlyShim = fileURLToPath(
  new URL('./test/shims/server-only.ts', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': serverOnlyShim,
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'app/**/*.{test,spec}.{ts,tsx}',
      'components/**/*.{test,spec}.{ts,tsx}',
      'lib/**/*.{test,spec}.{ts,tsx}',
      'tools/**/*.{test,spec}.{ts,tsx}',
      'test/**/*.{test,spec}.{ts,tsx}',
    ],
    setupFiles: ['./test/setup-client.ts'],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
  },
});
