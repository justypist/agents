import { createPresignedUpload } from "@/lib/oss";

type CreateFileUploadRequest = {
  filename: string;
  mediaType: string;
  size: number;
};

type CreateFileUploadResponse = {
  id: string;
  url: string;
  mediaType: string;
  filename: string;
  size: number;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

function isSupportedMediaType(mediaType: string): boolean {
  return mediaType.startsWith("image/") || mediaType === "application/pdf";
}

function isValidRequestBody(body: unknown): body is CreateFileUploadRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    "filename" in body &&
    "mediaType" in body &&
    "size" in body &&
    typeof body.filename === "string" &&
    typeof body.mediaType === "string" &&
    typeof body.size === "number" &&
    Number.isFinite(body.size) &&
    body.size >= 0
  );
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as unknown;

  if (!isValidRequestBody(body)) {
    return Response.json(
      { error: "请求参数不合法" },
      { status: 400 }
    );
  }

  if (!isSupportedMediaType(body.mediaType)) {
    return Response.json(
      { error: "当前仅支持图片和 PDF 附件" },
      { status: 415 }
    );
  }

  const upload = await createPresignedUpload({
    filename: body.filename || "upload",
    mediaType: body.mediaType,
    size: body.size,
  });

  const response: CreateFileUploadResponse = {
    id: upload.id,
    url: upload.url,
    mediaType: upload.mediaType,
    filename: upload.filename,
    size: upload.size,
    uploadUrl: upload.uploadUrl,
    uploadMethod: upload.uploadMethod,
    uploadHeaders: upload.uploadHeaders,
  };

  return Response.json(response);
}
