/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrepareUploadRequest, PrepareUploadResponse } from '@/lib/upload-types';

import { POST, runtime } from './route';
import { prepareUpload } from '@/lib/uploads/upload-service';

vi.mock('@/lib/uploads/upload-service', () => ({
  prepareUpload: vi.fn(),
}));

const validPayload: PrepareUploadRequest = {
  hash: 'a'.repeat(64),
  size: 42,
  mimeType: 'text/plain',
  originalFilename: 'notes.txt',
};

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/uploads/prepare', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/uploads/prepare', () => {
  beforeEach(() => {
    const response: PrepareUploadResponse = {
      status: 'exists',
      asset: {
        hash: validPayload.hash,
        key: 'files/a',
        url: 'https://oss.example/files/a',
        size: 42,
        mimeType: 'text/plain',
        metadata: {},
      },
    };
    vi.mocked(prepareUpload).mockResolvedValue(response);
  });

  it('runs in the nodejs runtime', () => {
    expect(runtime).toBe('nodejs');
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await POST(postJson({ ...validPayload, hash: 'bad' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid upload request.' });
    expect(prepareUpload).not.toHaveBeenCalled();
  });

  it('returns prepared upload data for valid payloads', async () => {
    const response = await POST(postJson(validPayload));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'exists' });
    expect(prepareUpload).toHaveBeenCalledWith(validPayload);
  });
});
