/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AbortUploadRequest } from '@/lib/upload-types';

import { POST, runtime } from './route';
import { abortUpload } from '@/lib/uploads/upload-service';

vi.mock('@/lib/uploads/upload-service', () => ({
  abortUpload: vi.fn(),
}));

const validPayload: AbortUploadRequest = {
  key: 'files/a',
  uploadId: 'upload-1',
};

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/uploads/abort', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/uploads/abort', () => {
  beforeEach(() => {
    vi.mocked(abortUpload).mockResolvedValue(undefined);
  });

  it('runs in the nodejs runtime', () => {
    expect(runtime).toBe('nodejs');
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(postJson({ ...validPayload, uploadId: '' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid abort request.' });
    expect(abortUpload).not.toHaveBeenCalled();
  });

  it('aborts valid payloads and returns no content', async () => {
    const response = await POST(postJson(validPayload));

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
    expect(abortUpload).toHaveBeenCalledWith(validPayload);
  });
});
