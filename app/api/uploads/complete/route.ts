import {
  completeMultipartUpload,
  completeSingleUpload,
} from '@/lib/oss-storage';
import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
} from '@/lib/upload-types';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const payload = await request.json();

  if (!isValidCompleteUploadRequest(payload)) {
    return Response.json({ error: 'Invalid completion request.' }, { status: 400 });
  }

  const asset =
    payload.status === 'single'
      ? await completeSingleUpload(payload)
      : await completeMultipartUpload(payload);
  const response: CompleteUploadResponse = {
    asset,
  };

  return Response.json(response);
}

function isValidCompleteUploadRequest(
  value: unknown,
): value is CompleteUploadRequest {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  if (
    (payload.status !== 'single' && payload.status !== 'multipart') ||
    typeof payload.hash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(payload.hash) ||
    typeof payload.key !== 'string' ||
    payload.key.trim().length === 0 ||
    typeof payload.size !== 'number' ||
    !Number.isFinite(payload.size) ||
    payload.size <= 0 ||
    typeof payload.mimeType !== 'string'
  ) {
    return false;
  }

  if (payload.status === 'single') {
    return true;
  }

  return (
    typeof payload.uploadId === 'string' &&
    payload.uploadId.length > 0 &&
    Array.isArray(payload.parts) &&
    payload.parts.length > 0 &&
    payload.parts.every(
      (part: unknown) =>
        typeof part === 'object' &&
        part != null &&
        'partNumber' in part &&
        'etag' in part &&
        typeof part.partNumber === 'number' &&
        Number.isInteger(part.partNumber) &&
        part.partNumber > 0 &&
        typeof part.etag === 'string' &&
        part.etag.length > 0,
    )
  );
}
