'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { ComposerAttachment, PendingAttachment } from '@/components/chat/attachments/types';
import { UploadCanceledError, uploadFileToOss } from '@/lib/upload-client';
import type { UploadedFileAsset } from '@/lib/upload-types';

export function useChatAttachments(): {
  attachments: PendingAttachment[];
  composerAttachments: ComposerAttachment[];
  uploadedAttachments: Array<PendingAttachment & { asset: UploadedFileAsset }>;
  isUploadingFiles: boolean;
  hasAttachmentErrors: boolean;
  handleFilesSelect: (fileList: FileList | null) => void;
  handleRemoveAttachment: (attachmentId: string) => void;
  clearAttachments: () => void;
} {
  const canceledUploadIdsRef = useRef<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const isUploadingFiles = attachments.some(
    attachment =>
      attachment.status === 'hashing' ||
      attachment.status === 'preparing' ||
      attachment.status === 'uploading' ||
      attachment.status === 'completing',
  );
  const hasAttachmentErrors = attachments.some(
    attachment => attachment.status === 'error',
  );
  const uploadedAttachments = useMemo(
    () =>
      attachments.filter(
        (attachment): attachment is PendingAttachment & { asset: UploadedFileAsset } =>
          attachment.status === 'uploaded' && attachment.asset != null,
      ),
    [attachments],
  );
  const composerAttachments = useMemo(
    () =>
      attachments.map(attachment => ({
        id: attachment.id,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.asset?.mimeType ?? normalizeMimeType(attachment.file.type),
        status: attachment.status,
        progress: attachment.progress,
        errorText: attachment.errorText,
      })),
    [attachments],
  );

  const updateAttachment = useCallback(
    (
      attachmentId: string,
      updater: (attachment: PendingAttachment) => PendingAttachment,
    ): void => {
      setAttachments(previousAttachments =>
        previousAttachments.map(attachment =>
          attachment.id === attachmentId ? updater(attachment) : attachment,
        ),
      );
    },
    [],
  );

  const uploadAttachment = useCallback(
    (attachmentId: string, file: File): void => {
      void (async () => {
        try {
          const result = await uploadFileToOss(file, {
            isCanceled: () => canceledUploadIdsRef.current.has(attachmentId),
            onStateChange: state => {
              updateAttachment(attachmentId, attachment => ({
                ...attachment,
                status: state,
                errorText: undefined,
              }));
            },
            onHashProgress: progress => {
              updateAttachment(attachmentId, attachment => ({
                ...attachment,
                status: 'hashing',
                progress,
              }));
            },
            onUploadProgress: progress => {
              updateAttachment(attachmentId, attachment => ({
                ...attachment,
                status: 'uploading',
                progress,
              }));
            },
          });

          if (canceledUploadIdsRef.current.has(attachmentId)) {
            return;
          }

          updateAttachment(attachmentId, attachment => ({
            ...attachment,
            status: 'uploaded',
            progress: 1,
            hash: result.hash,
            asset: result.asset,
            errorText: undefined,
          }));
        } catch (error) {
          if (
            error instanceof UploadCanceledError ||
            canceledUploadIdsRef.current.has(attachmentId)
          ) {
            return;
          }

          updateAttachment(attachmentId, attachment => ({
            ...attachment,
            status: 'error',
            errorText: toUploadErrorMessage(error),
          }));
        }
      })();
    },
    [updateAttachment],
  );

  const handleFilesSelect = useCallback(
    (fileList: FileList | null): void => {
      if (fileList == null || fileList.length === 0) {
        return;
      }

      const nextFiles = Array.from(fileList);
      const newAttachments = nextFiles
        .filter(
          file =>
            !attachments.some(attachment => isSameLocalFile(attachment.file, file)),
        )
        .reduce<PendingAttachment[]>((result, file) => {
          if (result.some(attachment => isSameLocalFile(attachment.file, file))) {
            return result;
          }

          result.push({
            id: crypto.randomUUID(),
            file,
            status: 'hashing',
            progress: 0,
          });

          return result;
        }, []);

      if (newAttachments.length === 0) {
        return;
      }

      for (const attachment of newAttachments) {
        canceledUploadIdsRef.current.delete(attachment.id);
      }

      setAttachments(previousAttachments => [...previousAttachments, ...newAttachments]);

      for (const attachment of newAttachments) {
        uploadAttachment(attachment.id, attachment.file);
      }
    },
    [attachments, uploadAttachment],
  );

  const handleRemoveAttachment = useCallback((attachmentId: string): void => {
    canceledUploadIdsRef.current.add(attachmentId);
    setAttachments(previousAttachments =>
      previousAttachments.filter(attachment => attachment.id !== attachmentId),
    );
  }, []);

  const clearAttachments = useCallback((): void => {
    canceledUploadIdsRef.current.clear();
    setAttachments([]);
  }, []);

  return {
    attachments,
    composerAttachments,
    uploadedAttachments,
    isUploadingFiles,
    hasAttachmentErrors,
    handleFilesSelect,
    handleRemoveAttachment,
    clearAttachments,
  };
}

function isSameLocalFile(left: File, right: File): boolean {
  return (
    left.name === right.name &&
    left.size === right.size &&
    left.lastModified === right.lastModified
  );
}

function toUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return '上传失败';
}

function normalizeMimeType(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : 'application/octet-stream';
}
