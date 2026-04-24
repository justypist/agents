import { jsonError } from '@/lib/api/responses';
import { listWorkspaceFiles, uploadWorkspaceFile } from '@/lib/workspace-files';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    return Response.json(await listWorkspaceFiles(url.searchParams.get('path')));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '读取 workspace 失败', 400);
  }
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const path = formData.get('path');
  const file = formData.get('file');

  if (typeof path !== 'string' && path != null) {
    return jsonError('Invalid workspace path.', 400);
  }

  if (!(file instanceof File)) {
    return jsonError('Missing upload file.', 400);
  }

  try {
    return Response.json({ item: await uploadWorkspaceFile(path, file) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '上传 workspace 文件失败', 400);
  }
}
