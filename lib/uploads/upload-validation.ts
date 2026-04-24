import type {
  AbortUploadRequest,
  CompleteUploadRequest,
  PrepareUploadRequest,
} from '@/lib/upload-types';

const SHA256_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidPrepareUploadRequest(
  value: unknown,
): value is PrepareUploadRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.hash === 'string' &&
    SHA256_HASH_PATTERN.test(value.hash) &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    value.size > 0 &&
    typeof value.mimeType === 'string' &&
    typeof value.originalFilename === 'string' &&
    value.originalFilename.trim().length > 0
  );
}

export function isValidCompleteUploadRequest(
  value: unknown,
): value is CompleteUploadRequest {
  if (!isRecord(value)) {
    return false;
  }

  if (
    (value.status !== 'single' && value.status !== 'multipart') ||
    typeof value.hash !== 'string' ||
    !SHA256_HASH_PATTERN.test(value.hash) ||
    typeof value.key !== 'string' ||
    value.key.trim().length === 0 ||
    typeof value.size !== 'number' ||
    !Number.isFinite(value.size) ||
    value.size <= 0 ||
    typeof value.mimeType !== 'string'
  ) {
    return false;
  }

  if (value.status === 'single') {
    return true;
  }

  return (
    typeof value.uploadId === 'string' &&
    value.uploadId.length > 0 &&
    Array.isArray(value.parts) &&
    value.parts.length > 0 &&
    value.parts.every(isValidCompletedUploadPart)
  );
}

export function isValidAbortUploadRequest(
  value: unknown,
): value is AbortUploadRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.key === 'string' &&
    value.key.trim().length > 0 &&
    typeof value.uploadId === 'string' &&
    value.uploadId.trim().length > 0
  );
}

function isValidCompletedUploadPart(value: unknown): value is {
  partNumber: number;
  etag: string;
} {
  return (
    isRecord(value) &&
    typeof value.partNumber === 'number' &&
    Number.isInteger(value.partNumber) &&
    value.partNumber > 0 &&
    typeof value.etag === 'string' &&
    value.etag.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
