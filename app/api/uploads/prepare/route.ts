import { parseJsonBody } from '@/lib/api/parse-json';
import { jsonError } from '@/lib/api/responses';
import { prepareUpload } from '@/lib/uploads/upload-service';
import { isValidPrepareUploadRequest } from '@/lib/uploads/upload-validation';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const payload = await parseJsonBody(request);

  if (!isValidPrepareUploadRequest(payload)) {
    return jsonError('Invalid upload request.', 400);
  }

  return Response.json(await prepareUpload(payload));
}
