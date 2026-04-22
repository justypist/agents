import { abortMultipartUpload } from '@/lib/oss-storage';
import type { AbortUploadRequest } from '@/lib/upload-types';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as Partial<AbortUploadRequest>;

  if (!isValidAbortUploadRequest(payload)) {
    return Response.json({ error: 'Invalid abort request.' }, { status: 400 });
  }

  await abortMultipartUpload(payload);

  return new Response(null, { status: 204 });
}

function isValidAbortUploadRequest(
  value: Partial<AbortUploadRequest>,
): value is AbortUploadRequest {
  return (
    typeof value.key === 'string' &&
    value.key.trim().length > 0 &&
    typeof value.uploadId === 'string' &&
    value.uploadId.trim().length > 0
  );
}
