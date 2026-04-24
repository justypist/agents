/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildObjectKey,
  completeMultipartUpload,
  createMultipartUpload,
  createSingleUpload,
  findExistingUploadedFile,
  shouldUseMultipartUpload,
} from './oss-storage';
import {
  MIN_MULTIPART_PART_SIZE_BYTES,
  MULTIPART_UPLOAD_THRESHOLD_BYTES,
} from './upload-types';

type CommandInput = Record<string, unknown>;

const awsMocks = vi.hoisted(() => {
  const send = vi.fn();
  const getSignedUrl = vi.fn();

  class MockCommand {
    input: CommandInput;

    constructor(input: CommandInput) {
      this.input = input;
    }
  }

  class MockS3Client {
    send = send;
  }

  return { send, getSignedUrl, MockCommand, MockS3Client };
});

vi.mock('@/config', () => ({
  config: {
    oss: {
      region: 'auto',
      baseUrl: 'https://oss.example.test/',
      accessKey: 'access-key',
      secretKey: 'secret-key',
      bucket: 'agents bucket',
    },
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  AbortMultipartUploadCommand: awsMocks.MockCommand,
  CompleteMultipartUploadCommand: awsMocks.MockCommand,
  CreateMultipartUploadCommand: awsMocks.MockCommand,
  HeadObjectCommand: awsMocks.MockCommand,
  PutObjectCommand: awsMocks.MockCommand,
  S3Client: awsMocks.MockS3Client,
  UploadPartCommand: awsMocks.MockCommand,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: awsMocks.getSignedUrl,
}));

describe('oss-storage', () => {
  beforeEach(() => {
    awsMocks.send.mockReset();
    awsMocks.getSignedUrl.mockReset();
    awsMocks.getSignedUrl.mockImplementation(
      async (_client: unknown, command: { input: { PartNumber?: number } }) =>
        command.input.PartNumber == null
          ? 'https://signed.example/single'
          : `https://signed.example/part-${command.input.PartNumber}`,
    );
  });

  it('builds object keys and detects multipart threshold boundaries', () => {
    expect(buildObjectKey('hash')).toBe('files/hash');
    expect(shouldUseMultipartUpload(MULTIPART_UPLOAD_THRESHOLD_BYTES - 1)).toBe(false);
    expect(shouldUseMultipartUpload(MULTIPART_UPLOAD_THRESHOLD_BYTES)).toBe(true);
  });

  it('creates single uploads with normalized metadata and headers', async () => {
    const result = await createSingleUpload({
      hash: 'a'.repeat(64),
      size: 42,
      mimeType: ' ',
    });

    expect(result).toEqual({
      asset: {
        hash: 'a'.repeat(64),
        key: `files/${'a'.repeat(64)}`,
        url: `https://oss.example.test/${encodeURIComponent('agents bucket')}/files/${'a'.repeat(64)}`,
        size: 42,
        mimeType: 'application/octet-stream',
        metadata: {
          hash: 'a'.repeat(64),
          size: '42',
          'mime-type': 'application/octet-stream',
        },
      },
      uploadUrl: 'https://signed.example/single',
      headers: {
        'content-type': 'application/octet-stream',
        'x-amz-meta-hash': 'a'.repeat(64),
        'x-amz-meta-size': '42',
        'x-amz-meta-mime-type': 'application/octet-stream',
      },
    });
    expect(awsMocks.getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('creates multipart uploads with aligned part numbers', async () => {
    awsMocks.send.mockResolvedValue({ UploadId: 'upload-1' });

    const result = await createMultipartUpload({
      hash: 'b'.repeat(64),
      size: MIN_MULTIPART_PART_SIZE_BYTES * 2 + 1,
      mimeType: 'text/plain',
    });

    expect(result.uploadId).toBe('upload-1');
    expect(result.partSize).toBe(MIN_MULTIPART_PART_SIZE_BYTES);
    expect(result.partUrls).toEqual([
      { partNumber: 1, url: 'https://signed.example/part-1' },
      { partNumber: 2, url: 'https://signed.example/part-2' },
      { partNumber: 3, url: 'https://signed.example/part-3' },
    ]);
  });

  it('throws when multipart creation does not return an upload id', async () => {
    awsMocks.send.mockResolvedValue({ UploadId: '' });

    await expect(
      createMultipartUpload({
        hash: 'b'.repeat(64),
        size: MIN_MULTIPART_PART_SIZE_BYTES,
        mimeType: 'text/plain',
      }),
    ).rejects.toThrow('Failed to create multipart upload.');
  });

  it('sorts completed multipart parts before completing', async () => {
    awsMocks.send.mockResolvedValueOnce({}).mockResolvedValueOnce({
      ContentLength: 42,
      ContentType: 'text/plain',
      Metadata: { hash: 'c'.repeat(64), empty: '' },
    });

    const result = await completeMultipartUpload({
      hash: 'c'.repeat(64),
      key: `files/${'c'.repeat(64)}`,
      size: 42,
      mimeType: 'text/plain',
      uploadId: 'upload-1',
      parts: [
        { partNumber: 2, etag: 'etag-2' },
        { partNumber: 1, etag: 'etag-1' },
      ],
    });

    expect(awsMocks.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          MultipartUpload: {
            Parts: [
              { PartNumber: 1, ETag: 'etag-1' },
              { PartNumber: 2, ETag: 'etag-2' },
            ],
          },
        }),
      }),
    );
    expect(result.metadata).toEqual({ hash: 'c'.repeat(64) });
  });

  it('returns null for missing objects and assets for existing objects', async () => {
    const notFound = new Error('not found');
    Object.defineProperty(notFound, '$metadata', {
      value: { httpStatusCode: 404 },
    });
    awsMocks.send.mockRejectedValueOnce(notFound);

    await expect(findExistingUploadedFile('d'.repeat(64))).resolves.toBeNull();

    awsMocks.send.mockResolvedValueOnce({
      ContentLength: 42,
      ContentType: 'text/plain',
      Metadata: { hash: 'd'.repeat(64) },
    });

    await expect(findExistingUploadedFile('d'.repeat(64))).resolves.toMatchObject({
      hash: 'd'.repeat(64),
      key: `files/${'d'.repeat(64)}`,
      size: 42,
      mimeType: 'text/plain',
    });
  });
});
