'use client';

import { useEffect, useMemo, useState } from 'react';

import { getWorkspacePreviewKind, type WorkspacePreviewKind } from '@/lib/workspace-preview';

import { ImageFilePart, TextFilePart } from './file-part';

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

type WorkspaceFileReference = {
  path: string;
  item: WorkspaceFileItem;
  previewKind: WorkspacePreviewKind;
};

type WorkspaceFileReferenceState = {
  pathsKey: string;
  references: WorkspaceFileReference[];
};

const MARKDOWN_WORKSPACE_PATH_PATTERN =
  /\]\(\s*(<?(?:file:\/\/\/workspace|\/workspace)\/[^)]+?>?)\s*\)/g;
const CODE_WORKSPACE_PATH_PATTERN =
  /`((?:file:\/\/\/workspace|\/workspace)\/[^`]+)`/g;
const BARE_WORKSPACE_PATH_PATTERN =
  /(?:file:\/\/\/workspace|\/workspace)\/([^<>"'`,;:!?，。；：！？、\])\n\r]+?)(?=\s+(?:file:\/\/\/workspace|\/workspace)|[<>"'`,;:!?，。；：！？、\])\n\r]|$)/g;
const TRAILING_PUNCTUATION_PATTERN = /[),.;:!?，。；：！？、\]}]+$/;
const TRAILING_TEXT_AFTER_EXTENSION_PATTERN =
  /^(.+\.[A-Za-z0-9][A-Za-z0-9_-]{0,15})(?:\s+.+)$/;
const WORKSPACE_URL_PREFIX = '/workspace/';
const FILE_WORKSPACE_URL_PREFIX = 'file:///workspace/';
const TEXT_PREVIEW_SIZE_LIMIT = 128 * 1024;

type WorkspacePathMatch = {
  end: number;
  path: string;
  start: number;
};

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

export function extractWorkspacePaths(text: string): string[] {
  const paths = new Set<string>();
  const consumedRanges: Array<{ end: number; start: number }> = [];
  const pathMatches: WorkspacePathMatch[] = [];

  for (const match of collectWorkspacePathMatches(
    text,
    MARKDOWN_WORKSPACE_PATH_PATTERN,
  )) {
    pathMatches.push(match);
    consumedRanges.push({ start: match.start, end: match.end });
  }

  for (const match of collectWorkspacePathMatches(text, CODE_WORKSPACE_PATH_PATTERN)) {
    pathMatches.push(match);
    consumedRanges.push({ start: match.start, end: match.end });
  }

  for (const match of collectWorkspacePathMatches(text, BARE_WORKSPACE_PATH_PATTERN)) {
    if (consumedRanges.some(range => match.start >= range.start && match.start < range.end)) {
      continue;
    }

    pathMatches.push(match);
  }

  pathMatches.sort((left, right) => left.start - right.start);

  for (const match of pathMatches) {
    addWorkspacePath(paths, match.path);
  }

  return Array.from(paths);
}

function collectWorkspacePathMatches(
  text: string,
  pattern: RegExp,
): WorkspacePathMatch[] {
  const matches: WorkspacePathMatch[] = [];

  for (const match of text.matchAll(pattern)) {
    const matchedText = match[0];
    const matchedPath = match[1];

    if (match.index == null || matchedPath == null) {
      continue;
    }

    matches.push({
      start: match.index,
      end: match.index + matchedText.length,
      path: matchedPath,
    });
  }

  return matches;
}

function addWorkspacePath(paths: Set<string>, value: string): void {
  const path = normalizeWorkspacePath(value);

  if (path != null && path.length > 0) {
    paths.add(path);
  }
}

function normalizeWorkspacePath(value: string): string | null {
  const url = value.trim().replace(/^<|>$/g, '');
  let path: string | null = null;

  if (url.startsWith(WORKSPACE_URL_PREFIX)) {
    path = url.slice(WORKSPACE_URL_PREFIX.length);
  }

  if (url.startsWith(FILE_WORKSPACE_URL_PREFIX)) {
    path = url.slice(FILE_WORKSPACE_URL_PREFIX.length);
  }

  if (path == null) {
    path = trimBareWorkspacePath(url);
  }

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function trimBareWorkspacePath(path: string): string {
  const trimmedPath = path.trim().replace(TRAILING_PUNCTUATION_PATTERN, '');
  const extensionMatch = trimmedPath.match(TRAILING_TEXT_AFTER_EXTENSION_PATTERN);

  return extensionMatch?.[1] ?? trimmedPath;
}

function createWorkspaceDownloadUrl(path: string): string {
  return `/api/workspace/download?path=${encodeURIComponent(path)}`;
}

function createWorkspaceInlineUrl(path: string): string {
  return `/api/workspace/download?path=${encodeURIComponent(path)}&disposition=inline`;
}

async function fetchWorkspaceFileItem(path: string): Promise<WorkspaceFileItem | null> {
  const response = await fetch(`/api/workspace?path=${encodeURIComponent(path)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json();

  if (!isWorkspaceListing(payload) || payload.item.type !== 'file') {
    return null;
  }

  return payload.item;
}

function normalizePreviewKind(item: WorkspaceFileItem): WorkspacePreviewKind {
  const previewKind = getWorkspacePreviewKind(item.name);

  if (previewKind === 'text' && item.size > TEXT_PREVIEW_SIZE_LIMIT) {
    return null;
  }

  return previewKind;
}

export function WorkspaceFileReferences({ text }: { text: string }) {
  const paths = useMemo(() => extractWorkspacePaths(text), [text]);
  const pathsKey = useMemo(() => paths.join('\0'), [paths]);
  const [referenceState, setReferenceState] =
    useState<WorkspaceFileReferenceState | null>(null);
  const references = referenceState?.pathsKey === pathsKey
    ? referenceState.references
    : [];

  useEffect(() => {
    let isActive = true;

    async function loadReferences(): Promise<void> {
      const nextReferences = await Promise.all(
        paths.map(async path => {
          const item = await fetchWorkspaceFileItem(path);

          if (item == null) {
            return null;
          }

          return {
            path,
            item,
            previewKind: normalizePreviewKind(item),
          } satisfies WorkspaceFileReference;
        }),
      );

      if (isActive) {
        setReferenceState({
          pathsKey,
          references: nextReferences.filter(reference => reference != null),
        });
      }
    }

    if (paths.length > 0) {
      void loadReferences();
    }

    return () => {
      isActive = false;
    };
  }, [paths, pathsKey]);

  if (references.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {references.map(reference => (
        <WorkspaceFileReferenceCard key={reference.path} reference={reference} />
      ))}
    </div>
  );
}

function WorkspaceFileReferenceCard({
  reference,
}: {
  reference: WorkspaceFileReference;
}) {
  const inlineUrl = createWorkspaceInlineUrl(reference.path);
  const downloadUrl = createWorkspaceDownloadUrl(reference.path);

  if (reference.previewKind === 'image') {
    return (
      <ImageFilePart
        part={{
          url: inlineUrl,
          filename: `/workspace/${reference.path}`,
          mediaType: 'image/*',
        }}
      />
    );
  }

  if (reference.previewKind === 'text') {
    return (
      <TextFilePart
        part={{
          url: inlineUrl,
          downloadUrl,
          filename: `/workspace/${reference.path}`,
          mediaType: 'text/plain',
        }}
      />
    );
  }

  return (
    <div className="inline-flex max-w-full items-center gap-2 border border-border px-3 py-2 text-sm text-foreground">
      <span className="min-w-0 truncate font-mono text-xs">
        /workspace/{reference.path}
      </span>
      <a
        href={downloadUrl}
        className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        下载
      </a>
    </div>
  );
}
