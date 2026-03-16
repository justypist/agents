import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const UPLOAD_DIR = join(tmpdir(), "agents-files");

type StoredUploadMeta = {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  createdAt: string;
};

export type StoredUpload = StoredUploadMeta & {
  data: Uint8Array;
};

export type SaveUploadInput = {
  data: Uint8Array;
  filename: string;
  mediaType: string;
  size: number;
};

function getDataPath(id: string) {
  return join(UPLOAD_DIR, `${id}.bin`);
}

function getMetaPath(id: string) {
  return join(UPLOAD_DIR, `${id}.json`);
}

function hasErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveUpload(input: SaveUploadInput) {
  await ensureUploadDir();

  const id = randomUUID();
  const meta: StoredUploadMeta = {
    id,
    filename: input.filename,
    mediaType: input.mediaType,
    size: input.size,
    createdAt: new Date().toISOString(),
  };

  await Promise.all([
    writeFile(getDataPath(id), input.data),
    writeFile(getMetaPath(id), JSON.stringify(meta)),
  ]);

  return meta;
}

export async function readUpload(id: string): Promise<StoredUpload | null> {
  try {
    const [data, metaText] = await Promise.all([
      readFile(getDataPath(id)),
      readFile(getMetaPath(id), "utf8"),
    ]);
    const meta = JSON.parse(metaText) as StoredUploadMeta;

    return {
      ...meta,
      data,
    };
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
}
