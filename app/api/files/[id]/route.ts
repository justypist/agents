import { readUpload } from "@/lib/upload-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function buildContentDisposition(filename: string) {
  return `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const file = await readUpload(id);

  if (!file) {
    return Response.json(
      { error: "文件不存在" },
      { status: 404 }
    );
  }

  const body = new Uint8Array(file.data.byteLength);
  body.set(file.data);

  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": buildContentDisposition(file.filename),
      "Content-Length": String(file.size),
      "Content-Type": file.mediaType,
    },
  });
}
