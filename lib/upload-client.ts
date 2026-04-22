import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import type {
  AbortUploadRequest,
  CompleteUploadRequest,
  CompleteUploadResponse,
  PrepareUploadRequest,
  PrepareUploadResponse,
  UploadedFileAsset,
} from '@/lib/upload-types';

const DEFAULT_MIME_TYPE = 'application/octet-stream';
const FILE_HASH_CHUNK_SIZE = 4 * 1024 * 1024;

export class UploadCanceledError extends Error {
  constructor() {
    super('Upload canceled.');
    this.name = 'UploadCanceledError';
  }
}

export async function uploadFileToOss(
  file: File,
  options: {
    isCanceled?: () => boolean;
    onStateChange?: (
      state: 'hashing' | 'preparing' | 'uploading' | 'completing',
    ) => void;
    onHashProgress?: (progress: number) => void;
    onUploadProgress?: (progress: number) => void;
  } = {},
): Promise<{ asset: UploadedFileAsset; hash: string }> {
  const mimeType = normalizeMimeType(file.type);
  options.onStateChange?.('hashing');
  const hash = await hashFile(file, options);

  ensureNotCanceled(options.isCanceled);
  options.onStateChange?.('preparing');

  const prepared = await postJson<PrepareUploadRequest, PrepareUploadResponse>(
    '/api/uploads/prepare',
    {
      hash,
      size: file.size,
      mimeType,
      originalFilename: file.name,
    },
  );

  ensureNotCanceled(options.isCanceled);

  if (prepared.status === 'exists') {
    options.onUploadProgress?.(1);
    return {
      asset: prepared.asset,
      hash,
    };
  }

  if (prepared.status === 'single') {
    options.onStateChange?.('uploading');
    await uploadBlobWithProgress({
      url: prepared.uploadUrl,
      blob: file,
      headers: prepared.headers,
      isCanceled: options.isCanceled,
      onProgress: options.onUploadProgress,
    });

    ensureNotCanceled(options.isCanceled);
    options.onStateChange?.('completing');

    const completed = await postJson<
      CompleteUploadRequest,
      CompleteUploadResponse
    >('/api/uploads/complete', {
      status: 'single',
      hash,
      key: prepared.asset.key,
      size: file.size,
      mimeType,
    });

    return {
      asset: completed.asset,
      hash,
    };
  }

  try {
    options.onStateChange?.('uploading');
    const parts = await uploadMultipartFile(file, prepared, options);

    ensureNotCanceled(options.isCanceled);
    options.onStateChange?.('completing');

    const completed = await postJson<
      CompleteUploadRequest,
      CompleteUploadResponse
    >('/api/uploads/complete', {
      status: 'multipart',
      hash,
      key: prepared.asset.key,
      size: file.size,
      mimeType,
      uploadId: prepared.uploadId,
      parts,
    });

    return {
      asset: completed.asset,
      hash,
    };
  } catch (error) {
    await abortMultipartUpload({
      key: prepared.asset.key,
      uploadId: prepared.uploadId,
    });

    throw error;
  }
}

async function hashFile(
  file: File,
  options: {
    isCanceled?: () => boolean;
    onHashProgress?: (progress: number) => void;
  },
): Promise<string> {
  const hasher = sha256.create();
  let offset = 0;

  while (offset < file.size) {
    ensureNotCanceled(options.isCanceled);

    const chunk = file.slice(offset, offset + FILE_HASH_CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    hasher.update(new Uint8Array(buffer));
    offset += chunk.size;
    options.onHashProgress?.(Math.min(offset / file.size, 1));
  }

  return bytesToHex(hasher.digest());
}

async function uploadMultipartFile(
  file: File,
  prepared: Extract<PrepareUploadResponse, { status: 'multipart' }>,
  options: {
    isCanceled?: () => boolean;
    onUploadProgress?: (progress: number) => void;
  },
): Promise<
  Array<{
    partNumber: number;
    etag: string;
  }>
> {
  const completedParts: Array<{
    partNumber: number;
    etag: string;
  }> = [];
  let uploadedBytes = 0;

  for (const part of prepared.partUrls) {
    ensureNotCanceled(options.isCanceled);

    const start = (part.partNumber - 1) * prepared.partSize;
    const end = Math.min(start + prepared.partSize, file.size);
    const blob = file.slice(start, end);
    const response = await uploadBlobWithProgress({
      url: part.url,
      blob,
      isCanceled: options.isCanceled,
      onProgress: progress => {
        options.onUploadProgress?.((uploadedBytes + blob.size * progress) / file.size);
      },
    });
    const etag = response.etag;

    if (etag == null || etag.length === 0) {
      throw new Error('Multipart upload requires the OSS CORS config to expose the ETag header.');
    }

    completedParts.push({
      partNumber: part.partNumber,
      etag,
    });
    uploadedBytes += blob.size;
    options.onUploadProgress?.(uploadedBytes / file.size);
  }

  return completedParts;
}

async function uploadBlobWithProgress(input: {
  url: string;
  blob: Blob;
  headers?: Record<string, string>;
  isCanceled?: () => boolean;
  onProgress?: (progress: number) => void;
}): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;

    const finish = (
      callback: () => void,
    ): void => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    request.open('PUT', input.url);

    for (const [headerName, headerValue] of Object.entries(input.headers ?? {})) {
      request.setRequestHeader(headerName, headerValue);
    }

    request.upload.addEventListener('progress', event => {
      if (input.isCanceled?.()) {
        request.abort();
        return;
      }

      if (!event.lengthComputable) {
        return;
      }

      input.onProgress?.(Math.min(event.loaded / event.total, 1));
    });

    request.addEventListener('load', () => {
      finish(() => {
        if (request.status >= 200 && request.status < 300) {
          resolve({
            etag: request.getResponseHeader('ETag'),
          });
          return;
        }

        reject(
          new Error(
            request.responseText || `Upload failed with status ${request.status}.`,
          ),
        );
      });
    });

    request.addEventListener('error', () => {
      finish(() => {
        reject(new Error('Upload request failed.'));
      });
    });

    request.addEventListener('abort', () => {
      finish(() => {
        reject(new UploadCanceledError());
      });
    });

    if (input.isCanceled?.()) {
      request.abort();
      return;
    }

    request.send(input.blob);
  });
}

async function abortMultipartUpload(payload: AbortUploadRequest): Promise<void> {
  try {
    await fetch('/api/uploads/abort', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignore abort failures so the original upload error is preserved.
  }
}

async function postJson<TRequest extends object, TResponse>(
  url: string,
  body: TRequest,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as TResponse;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };

    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // Fall through to status-based message.
  }

  return `Request failed with status ${response.status}.`;
}

function normalizeMimeType(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : DEFAULT_MIME_TYPE;
}

function ensureNotCanceled(isCanceled?: () => boolean): void {
  if (isCanceled?.()) {
    throw new UploadCanceledError();
  }
}
