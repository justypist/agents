export const UPLOAD_URL_TTL_SECONDS = 60 * 15;
export const MULTIPART_UPLOAD_THRESHOLD_BYTES = 16 * 1024 * 1024;
export const MIN_MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_MULTIPART_PARTS = 10_000;

export type UploadedFileAsset = {
  hash: string;
  key: string;
  url: string;
  size: number;
  mimeType: string;
  metadata: Record<string, string>;
};

export type PrepareUploadRequest = {
  hash: string;
  size: number;
  mimeType: string;
  originalFilename: string;
};

export type PrepareUploadResponse =
  | {
      status: 'exists';
      asset: UploadedFileAsset;
    }
  | {
      status: 'single';
      asset: UploadedFileAsset;
      uploadUrl: string;
      headers: Record<string, string>;
    }
  | {
      status: 'multipart';
      asset: UploadedFileAsset;
      uploadId: string;
      partSize: number;
      partUrls: Array<{
        partNumber: number;
        url: string;
      }>;
    };

export type CompleteUploadRequest =
  | {
      status: 'single';
      hash: string;
      key: string;
      size: number;
      mimeType: string;
    }
  | {
      status: 'multipart';
      hash: string;
      key: string;
      size: number;
      mimeType: string;
      uploadId: string;
      parts: Array<{
        partNumber: number;
        etag: string;
      }>;
    };

export type CompleteUploadResponse = {
  asset: UploadedFileAsset;
};

export type AbortUploadRequest = {
  key: string;
  uploadId: string;
};
