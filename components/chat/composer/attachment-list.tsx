'use client';

import { memo } from 'react';

import type { ComposerAttachment } from '@/components/chat/attachments/types';

export const AttachmentList = memo(function AttachmentList({
  attachments,
  isExpanded,
  onToggleExpanded,
  onRemoveAttachment,
}: {
  attachments: ComposerAttachment[];
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
}) {
  const isAttachmentListCollapsible = attachments.length > 4;
  const attachmentSummary = summarizeAttachments(attachments);
  const shouldShowAttachmentList = attachments.length <= 6 || isExpanded;

  return (
    <div className="mb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">{attachmentSummary}</p>

        {isAttachmentListCollapsible ? (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {shouldShowAttachmentList ? '收起' : '展开'}
          </button>
        ) : null}
      </div>

      {shouldShowAttachmentList ? (
        <div className="max-h-56 overflow-y-auto border border-border bg-background">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatAttachmentStatus(attachment)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemoveAttachment(attachment.id)}
                className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                移除
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});

function formatAttachmentStatus(attachment: ComposerAttachment): string {
  const sizeLabel = formatFileSize(attachment.size);

  switch (attachment.status) {
    case 'hashing':
      return `${sizeLabel} · 计算哈希中`;
    case 'preparing':
      return `${sizeLabel} · 申请上传地址中`;
    case 'uploading':
      return `${sizeLabel} · 上传中 ${Math.round(attachment.progress * 100)}%`;
    case 'completing':
      return `${sizeLabel} · 校验上传结果中`;
    case 'uploaded':
      return `${sizeLabel} · 已上传 · ${attachment.mimeType}`;
    case 'error':
      return `${sizeLabel} · ${attachment.errorText ?? '上传失败'}`;
    default:
      return sizeLabel;
  }
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function summarizeAttachments(attachments: ComposerAttachment[]): string {
  const uploadedCount = attachments.filter(
    attachment => attachment.status === 'uploaded',
  ).length;
  const activeCount = attachments.filter(
    attachment =>
      attachment.status === 'hashing' ||
      attachment.status === 'preparing' ||
      attachment.status === 'uploading' ||
      attachment.status === 'completing',
  ).length;
  const errorCount = attachments.filter(
    attachment => attachment.status === 'error',
  ).length;
  const summaryParts = [`共 ${attachments.length} 个文件`];

  if (activeCount > 0) {
    summaryParts.push(`上传中 ${activeCount}`);
  }

  if (uploadedCount > 0) {
    summaryParts.push(`已完成 ${uploadedCount}`);
  }

  if (errorCount > 0) {
    summaryParts.push(`失败 ${errorCount}`);
  }

  return summaryParts.join(' · ');
}
