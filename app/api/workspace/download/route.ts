import { jsonError } from '@/lib/api/responses';
import { downloadWorkspaceFile } from '@/lib/workspace-files';

export const runtime = 'nodejs';

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function getImageContentType(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (extension == null) {
    return null;
  }

  return IMAGE_CONTENT_TYPES[extension] ?? null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    const file = await downloadWorkspaceFile(url.searchParams.get('path'));
    const encodedFilename = encodeURIComponent(file.filename);
    const disposition = url.searchParams.get('disposition') === 'inline'
      ? 'inline'
      : 'attachment';
    const contentType = disposition === 'inline'
      ? getImageContentType(file.filename) ?? 'application/octet-stream'
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
