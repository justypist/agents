import { saveUpload } from "@/lib/upload-store";

type UploadFileResponse = {
  id: string;
  url: string;
  mediaType: string;
  filename: string;
};

function isSupportedMediaType(mediaType: string) {
  return mediaType.startsWith("image/") || mediaType === "application/pdf";
}

function getPublicOrigin(request: Request) {
  const originHeader = request.headers.get("origin");

  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {}
  }

  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "file 字段缺失" },
      { status: 400 }
    );
  }

  if (!isSupportedMediaType(file.type)) {
    return Response.json(
      { error: "当前仅支持图片和 PDF 附件" },
      { status: 415 }
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const storedFile = await saveUpload({
    data,
    filename: file.name || "upload",
    mediaType: file.type,
    size: file.size,
  });

  const response: UploadFileResponse = {
    id: storedFile.id,
    url: new URL(`/api/files/${storedFile.id}`, getPublicOrigin(request)).toString(),
    mediaType: storedFile.mediaType,
    filename: storedFile.filename,
  };

  return Response.json(response);
}
