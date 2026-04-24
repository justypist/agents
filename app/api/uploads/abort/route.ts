import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError, noContent } from '@/lib/api/responses';
import { abortUpload } from '@/lib/uploads/upload-service';
import { isValidAbortUploadRequest } from '@/lib/uploads/upload-validation';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const payload = await parseJsonBody(request);

  if (!isValidAbortUploadRequest(payload)) {
    return jsonError('Invalid abort request.', 400);
  }

  await abortUpload(payload);

  return noContent();
}
