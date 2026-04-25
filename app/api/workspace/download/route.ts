import { jsonError } from '@/lib/api/responses';
import { getWorkspaceFileContentType } from '@/lib/workspace-preview';
import { downloadWorkspaceFile } from '@/lib/workspace-files';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    const file = await downloadWorkspaceFile(url.searchParams.get('path'));
    const encodedFilename = encodeURIComponent(file.filename);
    const disposition = url.searchParams.get('disposition') === 'inline'
      ? 'inline'
      : 'attachment';
    const contentType = disposition === 'inline'
      ? getWorkspaceFileContentType(file.filename) ?? 'application/octet-stream'
      : 'application/octet-stream';

    return new Response(new Uint8Array(file.content), {
      headers: {
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedFilename}`,
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '下载 workspace 文件失败', 400);
  }
}
