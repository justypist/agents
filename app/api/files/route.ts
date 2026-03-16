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
    url: new URL(`/api/files/${storedFile.id}`, request.url).toString(),
    mediaType: storedFile.mediaType,
    filename: storedFile.filename,
  };

  return Response.json(response);
}
