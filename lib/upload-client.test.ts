import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UploadedFileAsset } from './upload-types';
import { UploadCanceledError, uploadFileToOss } from './upload-client';

const asset: UploadedFileAsset = {
  hash: 'unused',
  key: 'files/hash',
  url: 'https://oss.example/files/hash',
  size: 5,
  mimeType: 'text/plain',
  metadata: {},
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadFileToOss', () => {
  it('returns existing assets without uploading file bytes', async () => {
    const states: string[] = [];
    const hashProgress: number[] = [];
    const uploadProgress: number[] = [];
    fetchMock.mockResolvedValue(
      Response.json({
        status: 'exists',
        asset,
      }),
    );

    const result = await uploadFileToOss(new File(['hello'], 'hello.txt'), {
      onStateChange: state => states.push(state),
      onHashProgress: progress => hashProgress.push(progress),
      onUploadProgress: progress => uploadProgress.push(progress),
    });

    expect(result.asset).toEqual(asset);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(states).toEqual(['hashing', 'preparing']);
    expect(hashProgress).toEqual([1]);
    expect(uploadProgress).toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/uploads/prepare',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('normalizes empty mime types before prepare requests', async () => {
    fetchMock.mockResolvedValue(Response.json({ status: 'exists', asset }));

    await uploadFileToOss(new File(['hello'], 'hello.txt', { type: '' }));

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      mimeType: 'application/octet-stream',
      originalFilename: 'hello.txt',
      size: 5,
    });
  });

  it('throws API error messages from JSON responses', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'Invalid upload request.' }, { status: 400 }),
    );

    await expect(uploadFileToOss(new File(['hello'], 'hello.txt'))).rejects.toThrow(
      'Invalid upload request.',
    );
  });

  it('throws UploadCanceledError before making network requests when canceled', async () => {
    await expect(
      uploadFileToOss(new File(['hello'], 'hello.txt'), {
        isCanceled: () => true,
      }),
    ).rejects.toBeInstanceOf(UploadCanceledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
