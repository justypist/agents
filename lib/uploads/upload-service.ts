import 'server-only';

import {
  abortMultipartUpload,
  completeMultipartUpload,
  completeSingleUpload,
  createMultipartUpload,
  createSingleUpload,
  findExistingUploadedFile,
  shouldUseMultipartUpload,
} from '@/lib/oss-storage';
import type {
  AbortUploadRequest,
  CompleteUploadRequest,
  CompleteUploadResponse,
  PrepareUploadRequest,
  PrepareUploadResponse,
} from '@/lib/upload-types';

export async function prepareUpload(
  payload: PrepareUploadRequest,
): Promise<PrepareUploadResponse> {
  const existingAsset = await findExistingUploadedFile(payload.hash);

  if (existingAsset != null) {
    return {
      status: 'exists',
      asset: existingAsset,
    };
  }

  if (shouldUseMultipartUpload(payload.size)) {
    const response = await createMultipartUpload({
      hash: payload.hash,
      size: payload.size,
      mimeType: payload.mimeType,
    });

    return {
      status: 'multipart',
      ...response,
    };
  }

  const response = await createSingleUpload({
    hash: payload.hash,
    size: payload.size,
    mimeType: payload.mimeType,
  });

  return {
    status: 'single',
    ...response,
  };
}

export async function completeUpload(
  payload: CompleteUploadRequest,
): Promise<CompleteUploadResponse> {
  const asset =
    payload.status === 'single'
      ? await completeSingleUpload(payload)
      : await completeMultipartUpload(payload);

  return { asset };
}

export async function abortUpload(payload: AbortUploadRequest): Promise<void> {
  await abortMultipartUpload(payload);
}
