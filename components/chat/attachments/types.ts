import type { UploadedFileAsset } from '@/lib/upload-types';

export type AttachmentStatus =
  | 'hashing'
  | 'preparing'
  | 'uploading'
  | 'completing'
  | 'uploaded'
  | 'error';

export type PendingAttachment = {
  id: string;
  file: File;
  status: AttachmentStatus;
  progress: number;
  errorText?: string;
  hash?: string;
  asset?: UploadedFileAsset;
};

export type ComposerAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: AttachmentStatus;
  progress: number;
  errorText?: string;
};
