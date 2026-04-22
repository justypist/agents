import 'server-only';

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { config } from '@/config';
import {
  MAX_MULTIPART_PARTS,
  MIN_MULTIPART_PART_SIZE_BYTES,
  MULTIPART_UPLOAD_THRESHOLD_BYTES,
  UPLOAD_URL_TTL_SECONDS,
  type UploadedFileAsset,
} from '@/lib/upload-types';

const DEFAULT_MIME_TYPE = 'application/octet-stream';
const OBJECT_PREFIX = 'files';
const SINGLE_UPLOAD_SIGNABLE_HEADERS = new Set(['content-type']);
const SINGLE_UPLOAD_UNHOISTABLE_HEADERS = new Set([
  'x-amz-meta-hash',
  'x-amz-meta-size',
  'x-amz-meta-mime-type',
]);

const s3 = new S3Client({
  region: config.oss.region,
  endpoint: config.oss.baseUrl,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.oss.accessKey,
    secretAccessKey: config.oss.secretKey,
  },
});

export async function findExistingUploadedFile(
  hash: string,
): Promise<UploadedFileAsset | null> {
  const key = buildObjectKey(hash);

  try {
    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: config.oss.bucket,
        Key: key,
      }),
    );

    return toUploadedFileAsset({
      hash,
      key,
      size: response.ContentLength,
      mimeType: response.ContentType,
      metadata: response.Metadata,
    });
  } catch (error) {
    if (isMissingObjectError(error)) {
      return null;
    }

    throw error;
  }
}

export async function createSingleUpload(input: {
  hash: string;
  size: number;
  mimeType: string;
}): Promise<{
  asset: UploadedFileAsset;
  uploadUrl: string;
  headers: Record<string, string>;
}> {
  const key = buildObjectKey(input.hash);
  const mimeType = normalizeMimeType(input.mimeType);
  const metadata = buildObjectMetadata({
    hash: input.hash,
    size: input.size,
    mimeType,
  });

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: config.oss.bucket,
      Key: key,
      ContentType: mimeType,
      Metadata: metadata,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: SINGLE_UPLOAD_SIGNABLE_HEADERS,
      unhoistableHeaders: SINGLE_UPLOAD_UNHOISTABLE_HEADERS,
    },
  );

  return {
    asset: toUploadedFileAsset({
      hash: input.hash,
      key,
      size: input.size,
      mimeType,
      metadata,
    }),
    uploadUrl,
    headers: {
      'content-type': mimeType,
      'x-amz-meta-hash': metadata.hash,
      'x-amz-meta-size': metadata.size,
      'x-amz-meta-mime-type': metadata['mime-type'],
    },
  };
}

export async function createMultipartUpload(input: {
  hash: string;
  size: number;
  mimeType: string;
}): Promise<{
  asset: UploadedFileAsset;
  uploadId: string;
  partSize: number;
  partUrls: Array<{
    partNumber: number;
    url: string;
  }>;
}> {
  const key = buildObjectKey(input.hash);
  const mimeType = normalizeMimeType(input.mimeType);
  const metadata = buildObjectMetadata({
    hash: input.hash,
    size: input.size,
    mimeType,
  });
  const createResponse = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: config.oss.bucket,
      Key: key,
      ContentType: mimeType,
      Metadata: metadata,
    }),
  );

  if (createResponse.UploadId == null || createResponse.UploadId.length === 0) {
    throw new Error('Failed to create multipart upload.');
  }

  const uploadId = createResponse.UploadId;
  const partSize = resolveMultipartPartSize(input.size);
  const partCount = Math.ceil(input.size / partSize);
  const partUrls = await Promise.all(
    Array.from({ length: partCount }, async (_, index) => {
      const partNumber = index + 1;
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: config.oss.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        {
          expiresIn: UPLOAD_URL_TTL_SECONDS,
        },
      );

      return {
        partNumber,
        url,
      };
    }),
  );

  return {
    asset: toUploadedFileAsset({
      hash: input.hash,
      key,
      size: input.size,
      mimeType,
      metadata,
    }),
    uploadId,
    partSize,
    partUrls,
  };
}

export async function completeSingleUpload(input: {
  hash: string;
  key: string;
  size: number;
  mimeType: string;
}): Promise<UploadedFileAsset> {
  return headUploadedFile(input);
}

export async function completeMultipartUpload(input: {
  hash: string;
  key: string;
  size: number;
  mimeType: string;
  uploadId: string;
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
}): Promise<UploadedFileAsset> {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.oss.bucket,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: input.parts
          .slice()
          .sort((left, right) => left.partNumber - right.partNumber)
          .map(part => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
      },
    }),
  );

  return headUploadedFile(input);
}

export async function abortMultipartUpload(input: {
  key: string;
  uploadId: string;
}): Promise<void> {
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: config.oss.bucket,
      Key: input.key,
      UploadId: input.uploadId,
    }),
  );
}

export function shouldUseMultipartUpload(size: number): boolean {
  return size >= MULTIPART_UPLOAD_THRESHOLD_BYTES;
}

export function buildObjectKey(hash: string): string {
  return `${OBJECT_PREFIX}/${hash}`;
}

function buildPublicFileUrl(key: string): string {
  const trimmedBaseUrl = config.oss.baseUrl.replace(/\/+$/, '');
  const encodedBucket = encodeURIComponent(config.oss.bucket);
  const encodedKey = key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');

  return `${trimmedBaseUrl}/${encodedBucket}/${encodedKey}`;
}

async function headUploadedFile(input: {
  hash: string;
  key: string;
  size: number;
  mimeType: string;
}): Promise<UploadedFileAsset> {
  const response = await s3.send(
    new HeadObjectCommand({
      Bucket: config.oss.bucket,
      Key: input.key,
    }),
  );
  const contentLength = response.ContentLength ?? 0;

  if (contentLength !== input.size) {
    throw new Error('Uploaded file size mismatch.');
  }

  return toUploadedFileAsset({
    hash: input.hash,
    key: input.key,
    size: response.ContentLength,
    mimeType: response.ContentType ?? input.mimeType,
    metadata: response.Metadata,
  });
}

function resolveMultipartPartSize(fileSize: number): number {
  const minPartSize = Math.max(
    MIN_MULTIPART_PART_SIZE_BYTES,
    Math.ceil(fileSize / MAX_MULTIPART_PARTS),
  );
  const alignedPartSize = Math.ceil(minPartSize / (1024 * 1024)) * 1024 * 1024;

  return alignedPartSize;
}

function normalizeMimeType(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : DEFAULT_MIME_TYPE;
}

function buildObjectMetadata(input: {
  hash: string;
  size: number;
  mimeType: string;
}): Record<string, string> {
  return {
    hash: input.hash,
    size: String(input.size),
    'mime-type': input.mimeType,
  };
}

function toUploadedFileAsset(input: {
  hash: string;
  key: string;
  size: number | undefined;
  mimeType: string | undefined;
  metadata: Record<string, string> | undefined;
}): UploadedFileAsset {
  return {
    hash: input.hash,
    key: input.key,
    url: buildPublicFileUrl(input.key),
    size: input.size ?? 0,
    mimeType: normalizeMimeType(input.mimeType ?? DEFAULT_MIME_TYPE),
    metadata: filterMetadata(input.metadata),
  };
}

function filterMetadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> {
  if (metadata == null) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value.length > 0),
  );
}

function isMissingObjectError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const responseMetadata = '$metadata' in error ? error.$metadata : undefined;

  if (
    typeof responseMetadata === 'object' &&
    responseMetadata != null &&
    'httpStatusCode' in responseMetadata &&
    responseMetadata.httpStatusCode === 404
  ) {
    return true;
  }

  return error.name === 'NotFound' || error.name === 'NoSuchKey';
}
