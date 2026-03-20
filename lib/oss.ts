import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { config } from "@/config";

export type CreateOssUploadInput = {
  filename: string;
  mediaType: string;
  size: number;
};

export type PresignedUpload = {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  url: string;
  uploadUrl: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
};

function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildContentDisposition(filename: string): string {
  return `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const ossClient = new S3Client({
  region: config.oss.region,
  endpoint: config.oss.endpoint,
  forcePathStyle: config.oss.forcePathStyle,
  credentials: {
    accessKeyId: config.oss.accessKeyId,
    secretAccessKey: config.oss.secretAccessKey,
  },
});

function buildOssObjectKey(id: string): string {
  if (!config.oss.keyPrefix) {
    return id;
  }

  return `${config.oss.keyPrefix}/${id}`;
}

function getOssPublicUrl(key: string): string {
  return `${config.oss.publicBaseUrl}/${encodeObjectKey(key)}`;
}

export async function createPresignedUpload(
  input: CreateOssUploadInput
): Promise<PresignedUpload> {
  const id = randomUUID();
  const key = buildOssObjectKey(id);
  const contentDisposition = buildContentDisposition(input.filename);
  const cacheControl = "public, max-age=3600";
  const uploadHeaders: Record<string, string> = {
    "Cache-Control": cacheControl,
    "Content-Disposition": contentDisposition,
    "Content-Type": input.mediaType,
  };
  const command = new PutObjectCommand({
    Bucket: config.oss.bucket,
    Key: key,
    ContentType: input.mediaType,
    ContentDisposition: contentDisposition,
    CacheControl: cacheControl,
  });
  const uploadUrl = await getSignedUrl(ossClient, command, {
    expiresIn: 300,
  });

  return {
    id,
    filename: input.filename,
    mediaType: input.mediaType,
    size: input.size,
    url: getOssPublicUrl(key),
    uploadUrl,
    uploadMethod: "PUT",
    uploadHeaders,
  };
}
