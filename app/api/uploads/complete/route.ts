import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import { completeUpload } from '@/lib/uploads/upload-service';
import { isValidCompleteUploadRequest } from '@/lib/uploads/upload-validation';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const payload = await parseJsonBody(request);

  if (!isValidCompleteUploadRequest(payload)) {
    return jsonError('Invalid completion request.', 400);
  }

  return Response.json(await completeUpload(payload));
}
