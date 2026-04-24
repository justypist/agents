'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoadingSpinner } from '@/components/ui/loading-spinner';

type WorkspaceFileType = 'file' | 'directory' | 'other';

type WorkspaceFileItem = {
  name: string;
  path: string;
  type: WorkspaceFileType;
  size: number;
  modifiedAt: string;
};

type WorkspaceListing = {
  path: string;
  parentPath: string | null;
  item: WorkspaceFileItem;
  children: WorkspaceFileItem[];
};

type UploadState = 'idle' | 'uploading';

function isWorkspaceFileItem(value: unknown): value is WorkspaceFileItem {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.name === 'string' &&
    typeof candidate.path === 'string' &&
    (candidate.type === 'file' ||
      candidate.type === 'directory' ||
      candidate.type === 'other') &&
    typeof candidate.size === 'number' &&
    typeof candidate.modifiedAt === 'string'
  );
}

function isWorkspaceListing(value: unknown): value is WorkspaceListing {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.path === 'string' &&
    (typeof candidate.parentPath === 'string' || candidate.parentPath == null) &&
    isWorkspaceFileItem(candidate.item) &&
    Array.isArray(candidate.children) &&
    candidate.children.every(isWorkspaceFileItem)
  );
}

function formatSize(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function createWorkspaceUrl(path: string): string {
  if (path.length === 0) {
    return '/workspace';
  }

  return `/workspace?path=${encodeURIComponent(path)}`;
}

function createDownloadUrl(path: string): string {
  return `/api/workspace/download?path=${encodeURIComponent(path)}`;
}

function createPreviewUrl(path: string): string {
  return `/api/workspace/download?path=${encodeURIComponent(path)}&disposition=inline`;
}

function isImageFile(item: WorkspaceFileItem): boolean {
  if (item.type !== 'file') {
    return false;
  }

  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(item.name);
}

function getBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  if (path.length === 0) {
    return [{ label: 'workspace', path: '' }];
  }

  const parts = path.split('/').filter(Boolean);

  return [
    { label: 'workspace', path: '' },
    ...parts.map((part, index) => ({
      label: part,
      path: parts.slice(0, index + 1).join('/'),
    })),
  ];
}

export function WorkspaceBrowser() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentPath, setCurrentPath] = useState('');
  const [listing, setListing] = useState<WorkspaceListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [previewItem, setPreviewItem] = useState<WorkspaceFileItem | null>(null);
  const breadcrumbs = useMemo(() => getBreadcrumbs(currentPath), [currentPath]);

  const loadPath = useCallback(async (path: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspace?path=${encodeURIComponent(path)}`,
        { cache: 'no-store' },
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload != null &&
          typeof (payload as Record<string, unknown>).error === 'string'
            ? (payload as { error: string }).error
            : '读取 workspace 失败';
        throw new Error(message);
      }

      if (!isWorkspaceListing(payload)) {
        throw new Error('workspace 响应格式无效');
      }

      setListing(payload);
      setCurrentPath(payload.path);
      window.history.replaceState(null, '', createWorkspaceUrl(payload.path));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取 workspace 失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    void loadPath(params.get('path') || '');
  }, [loadPath]);

  const handleOpen = (item: WorkspaceFileItem): void => {
    if (item.type !== 'directory') {
      return;
    }

    void loadPath(item.path);
  };

  const handleUpload = async (files: FileList | null): Promise<void> => {
    const file = files?.[0];

    if (file == null) {
      return;
    }

    setUploadState('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.set('path', currentPath);
      formData.set('file', file);
      const response = await fetch('/api/workspace', {
        body: formData,
        method: 'POST',
      });

      if (!response.ok) {
        const payload: unknown = await response.json();
        const message =
          typeof payload === 'object' &&
          payload != null &&
          typeof (payload as Record<string, unknown>).error === 'string'
            ? (payload as { error: string }).error
            : '上传 workspace 文件失败';
        throw new Error(message);
      }

      await loadPath(currentPath);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : '上传 workspace 文件失败',
      );
    } finally {
      setUploadState('idle');

      if (fileInputRef.current != null) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header className="border-b border-border pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link
                href="/"
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                ← 返回 agents
              </Link>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Docker Workspace
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                沙箱文件柜
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                查看持久 Docker workspace 中的文件。这里的内容来自 exec
                沙箱容器的 <span className="font-mono text-foreground">/workspace</span>。
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={event => {
                  void handleUpload(event.target.files);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === 'uploading'}
                className="border border-border-strong bg-foreground px-4 py-2 text-sm text-background transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadState === 'uploading' ? '上传中...' : '上传文件'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void loadPath(currentPath);
                }}
                className="border border-border px-4 py-2 text-sm transition hover:border-border-strong hover:bg-muted"
              >
                刷新
              </button>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap items-center gap-2 border-b border-border py-4 font-mono text-xs text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <span
              key={item.path || 'root'}
              className="flex items-center gap-2"
            >
              {index > 0 ? <span>/</span> : null}
              <button
                type="button"
                onClick={() => {
                  void loadPath(item.path);
                }}
                className="text-left transition hover:text-foreground"
              >
                {item.label}
              </button>
            </span>
          ))}
        </nav>

        {error != null ? (
          <div className="mt-6 border border-border-strong bg-muted px-4 py-3 text-sm text-foreground">
            {error}
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden border border-border">
          <div className="grid grid-cols-[1fr_auto] border-b border-border bg-muted px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground sm:grid-cols-[1fr_120px_190px_120px]">
            <span>名称</span>
            <span className="hidden sm:block">大小</span>
            <span className="hidden sm:block">修改时间</span>
            <span className="text-right">操作</span>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 px-4 py-8 text-sm text-muted-foreground">
              <LoadingSpinner className="h-4 w-4" />
              正在读取 workspace...
            </div>
          ) : listing == null || listing.children.length === 0 ? (
            <div className="px-4 py-10 text-sm text-muted-foreground">
              当前目录为空。上传一个文件，或让 agent 在这里生成内容。
            </div>
          ) : (
            <div className="divide-y divide-border">
              {listing.parentPath != null ? (
                <FileRow
                  item={{
                    name: '..',
                    path: listing.parentPath,
                    type: 'directory',
                    size: 0,
                    modifiedAt: listing.item.modifiedAt,
                  }}
                  isParent
                  onOpen={handleOpen}
                />
              ) : null}
              {listing.children.map(item => (
                <FileRow
                  key={item.path}
                  item={item}
                  onOpen={handleOpen}
                  onPreview={setPreviewItem}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {previewItem != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="关闭预览"
            className="absolute inset-0 cursor-default"
            onClick={() => setPreviewItem(null)}
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  /workspace/{previewItem.path}
                </p>
                <h2 className="truncate text-sm font-medium">{previewItem.name}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                <a
                  href={createPreviewUrl(previewItem.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  新标签打开
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="border border-border px-3 py-1 transition hover:border-border-strong hover:bg-muted"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={createPreviewUrl(previewItem.path)}
                alt={previewItem.name}
                className="max-h-[78vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type FileRowProps = {
  item: WorkspaceFileItem;
  isParent?: boolean;
  onOpen: (item: WorkspaceFileItem) => void;
  onPreview?: (item: WorkspaceFileItem) => void;
};

function FileRow({ item, isParent = false, onOpen, onPreview }: FileRowProps) {
  const icon = item.type === 'directory' ? 'DIR' : item.type === 'file' ? 'FILE' : 'NODE';
  const canPreview = isImageFile(item) && onPreview != null;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 text-sm transition hover:bg-muted/60 sm:grid-cols-[1fr_120px_190px_120px]">
      <button
        type="button"
        onClick={() => onOpen(item)}
        disabled={item.type !== 'directory'}
        className="min-w-0 text-left disabled:cursor-default"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
            {icon}
          </span>
          <span className="truncate font-medium text-foreground">{item.name}</span>
        </span>
      </button>
      <span className="hidden font-mono text-xs text-muted-foreground sm:block">
        {isParent || item.type === 'directory' ? '-' : formatSize(item.size)}
      </span>
      <span className="hidden text-xs text-muted-foreground sm:block">
        {isParent ? '-' : formatTime(item.modifiedAt)}
      </span>
      <span className="flex justify-end gap-3 text-xs">
        {item.type === 'directory' ? (
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="text-muted-foreground transition hover:text-foreground"
          >
            打开
          </button>
        ) : item.type === 'file' ? (
          <>
            {canPreview ? (
              <button
                type="button"
                onClick={() => onPreview(item)}
                className="text-muted-foreground transition hover:text-foreground"
              >
                预览
              </button>
            ) : null}
            {isImageFile(item) ? (
              <a
                href={createPreviewUrl(item.path)}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition hover:text-foreground"
              >
                打开
              </a>
            ) : null}
            <a
              href={createDownloadUrl(item.path)}
              className="text-muted-foreground transition hover:text-foreground"
            >
              下载
            </a>
          </>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </span>
    </div>
  );
}
