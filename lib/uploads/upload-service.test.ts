/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AbortUploadRequest,
  CompleteUploadRequest,
  PrepareUploadRequest,
  UploadedFileAsset,
} from '@/lib/upload-types';

import { abortUpload, completeUpload, prepareUpload } from './upload-service';
import {
  abortMultipartUpload,
  completeMultipartUpload,
  completeSingleUpload,
  createMultipartUpload,
  createSingleUpload,
  findExistingUploadedFile,
  shouldUseMultipartUpload,
} from '../oss-storage';

vi.mock('../oss-storage', () => ({
  abortMultipartUpload: vi.fn(),
  completeMultipartUpload: vi.fn(),
  completeSingleUpload: vi.fn(),
  createMultipartUpload: vi.fn(),
  createSingleUpload: vi.fn(),
  findExistingUploadedFile: vi.fn(),
  shouldUseMultipartUpload: vi.fn(),
}));

const asset: UploadedFileAsset = {
  hash: 'a'.repeat(64),
  key: 'files/a',
  url: 'https://oss.example/files/a',
  size: 42,
  mimeType: 'text/plain',
  metadata: {},
};

const preparePayload: PrepareUploadRequest = {
  hash: asset.hash,
  size: asset.size,
  mimeType: asset.mimeType,
  originalFilename: 'notes.txt',
};

describe('upload-service', () => {
  beforeEach(() => {
    vi.mocked(findExistingUploadedFile).mockResolvedValue(null);
    vi.mocked(shouldUseMultipartUpload).mockReturnValue(false);
  });

  it('returns existing assets without creating an upload', async () => {
    vi.mocked(findExistingUploadedFile).mockResolvedValue(asset);

    await expect(prepareUpload(preparePayload)).resolves.toEqual({
      status: 'exists',
      asset,
    });
    expect(createSingleUpload).not.toHaveBeenCalled();
    expect(createMultipartUpload).not.toHaveBeenCalled();
  });

  it('creates single uploads for small files', async () => {
    vi.mocked(createSingleUpload).mockResolvedValue({
      asset,
      uploadUrl: 'https://upload.example/single',
      headers: { 'content-type': 'text/plain' },
    });

    await expect(prepareUpload(preparePayload)).resolves.toEqual({
      status: 'single',
      asset,
      uploadUrl: 'https://upload.example/single',
      headers: { 'content-type': 'text/plain' },
    });
    expect(createSingleUpload).toHaveBeenCalledWith({
      hash: preparePayload.hash,
      size: preparePayload.size,
      mimeType: preparePayload.mimeType,
    });
  });

  it('creates multipart uploads for large files', async () => {
    vi.mocked(shouldUseMultipartUpload).mockReturnValue(true);
    vi.mocked(createMultipartUpload).mockResolvedValue({
      asset,
      uploadId: 'upload-1',
      partSize: 8,
      partUrls: [{ partNumber: 1, url: 'https://upload.example/part-1' }],
    });

    await expect(prepareUpload(preparePayload)).resolves.toEqual({
      status: 'multipart',
      asset,
      uploadId: 'upload-1',
      partSize: 8,
      partUrls: [{ partNumber: 1, url: 'https://upload.example/part-1' }],
    });
    expect(createMultipartUpload).toHaveBeenCalledWith({
      hash: preparePayload.hash,
      size: preparePayload.size,
      mimeType: preparePayload.mimeType,
    });
  });

  it('completes single and multipart uploads through the matching storage method', async () => {
    vi.mocked(completeSingleUpload).mockResolvedValue(asset);
    vi.mocked(completeMultipartUpload).mockResolvedValue({ ...asset, key: 'files/b' });
    const singlePayload: CompleteUploadRequest = {
      status: 'single',
      hash: asset.hash,
      key: asset.key,
      size: asset.size,
      mimeType: asset.mimeType,
    };
    const multipartPayload: CompleteUploadRequest = {
      status: 'multipart',
      hash: asset.hash,
      key: asset.key,
      size: asset.size,
      mimeType: asset.mimeType,
      uploadId: 'upload-1',
      parts: [{ partNumber: 1, etag: 'etag-1' }],
    };

    await expect(completeUpload(singlePayload)).resolves.toEqual({ asset });
    await expect(completeUpload(multipartPayload)).resolves.toEqual({
      asset: { ...asset, key: 'files/b' },
    });
    expect(completeSingleUpload).toHaveBeenCalledWith(singlePayload);
    expect(completeMultipartUpload).toHaveBeenCalledWith(multipartPayload);
  });

  it('aborts multipart uploads', async () => {
    const payload: AbortUploadRequest = { key: 'files/a', uploadId: 'upload-1' };

    await expect(abortUpload(payload)).resolves.toBeUndefined();
    expect(abortMultipartUpload).toHaveBeenCalledWith(payload);
  });
});
