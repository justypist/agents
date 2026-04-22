import {
  createMultipartUpload,
  createSingleUpload,
  findExistingUploadedFile,
  shouldUseMultipartUpload,
} from '@/lib/oss-storage';
import type {
  PrepareUploadRequest,
  PrepareUploadResponse,
} from '@/lib/upload-types';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as Partial<PrepareUploadRequest>;

  if (!isValidPrepareUploadRequest(payload)) {
    return Response.json({ error: 'Invalid upload request.' }, { status: 400 });
  }

  const existingAsset = await findExistingUploadedFile(payload.hash);

  if (existingAsset != null) {
    const response: PrepareUploadResponse = {
      status: 'exists',
      asset: existingAsset,
    };

    return Response.json(response);
  }

  if (shouldUseMultipartUpload(payload.size)) {
    const response = await createMultipartUpload({
      hash: payload.hash,
      size: payload.size,
      mimeType: payload.mimeType,
    });

    return Response.json({
      status: 'multipart',
      ...response,
    } satisfies PrepareUploadResponse);
  }

  const response = await createSingleUpload({
    hash: payload.hash,
    size: payload.size,
    mimeType: payload.mimeType,
  });

  return Response.json({
    status: 'single',
    ...response,
  } satisfies PrepareUploadResponse);
}

function isValidPrepareUploadRequest(
  value: Partial<PrepareUploadRequest>,
): value is PrepareUploadRequest {
  return (
    typeof value.hash === 'string' &&
    /^[a-f0-9]{64}$/i.test(value.hash) &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    value.size > 0 &&
    typeof value.mimeType === 'string' &&
    typeof value.originalFilename === 'string' &&
    value.originalFilename.trim().length > 0
  );
}
