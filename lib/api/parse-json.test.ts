/** @vitest-environment node */

import { describe, expect, it } from 'vitest';

import { parseJsonBody } from './parse-json';

describe('parseJsonBody', () => {
  it('returns parsed JSON payloads', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    });

    await expect(parseJsonBody(request)).resolves.toEqual({ ok: true });
  });

  it('returns null for invalid JSON', async () => {
    const request = new Request('http://localhost/api', {
      method: 'POST',
      body: '{invalid',
    });

    await expect(parseJsonBody(request)).resolves.toBeNull();
  });
});
