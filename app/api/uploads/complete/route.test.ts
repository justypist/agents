/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompleteUploadRequest, CompleteUploadResponse } from '@/lib/upload-types';

import { POST, runtime } from './route';
import { completeUpload } from '@/lib/uploads/upload-service';

vi.mock('@/lib/uploads/upload-service', () => ({
  completeUpload: vi.fn(),
}));

const validPayload: CompleteUploadRequest = {
  status: 'single',
  hash: 'a'.repeat(64),
  key: 'files/a',
  size: 42,
  mimeType: 'text/plain',
};

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/uploads/complete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/uploads/complete', () => {
  beforeEach(() => {
    const response: CompleteUploadResponse = {
      asset: {
        hash: validPayload.hash,
        key: validPayload.key,
        url: 'https://oss.example/files/a',
        size: validPayload.size,
        mimeType: validPayload.mimeType,
        metadata: {},
      },
    };
    vi.mocked(completeUpload).mockResolvedValue(response);
  });

  it('runs in the nodejs runtime', () => {
    expect(runtime).toBe('nodejs');
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(postJson({ ...validPayload, key: ' ' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid completion request.' });
    expect(completeUpload).not.toHaveBeenCalled();
  });

  it('returns completed upload data for valid payloads', async () => {
    const response = await POST(postJson(validPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      asset: { key: validPayload.key },
    });
    expect(completeUpload).toHaveBeenCalledWith(validPayload);
  });
});
