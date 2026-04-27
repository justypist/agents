'use client';

import { memo } from 'react';
import { defaultUrlTransform, Streamdown, type UrlTransform } from 'streamdown';

import { WorkspaceFileReferences } from './workspace-file-references';

type TextPartProps = {
  text: string;
  state?: 'streaming' | 'done';
};

const WORKSPACE_URL_PREFIX = '/workspace/';
const FILE_WORKSPACE_URL_PREFIX = 'file:///workspace/';

function extractWorkspaceLinkPath(url: string): string | null {
  if (url.startsWith(WORKSPACE_URL_PREFIX)) {
    return decodeWorkspacePath(url.slice(WORKSPACE_URL_PREFIX.length));
  }

  if (url.startsWith(FILE_WORKSPACE_URL_PREFIX)) {
    return decodeWorkspacePath(url.slice(FILE_WORKSPACE_URL_PREFIX.length));
  }

  return null;
}

function decodeWorkspacePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export const chatMarkdownUrlTransform: UrlTransform = (url, key, node) => {
  if (key === 'href' || key === 'src') {
    const workspacePath = extractWorkspaceLinkPath(url);

    if (workspacePath != null && workspacePath.length > 0) {
      const downloadUrl = `/api/workspace/download?path=${encodeURIComponent(workspacePath)}`;

      return key === 'src' ? `${downloadUrl}&disposition=inline` : downloadUrl;
    }
  }

  return defaultUrlTransform(url, key, node);
};

export const TextPart = memo(function TextPart({ text, state }: TextPartProps) {
  return (
    <>
      <Streamdown
        dir="auto"
        mode={state === 'streaming' ? 'streaming' : 'static'}
        urlTransform={chatMarkdownUrlTransform}
        className={[
          'text-foreground',
          '[&>blockquote]:border-l',
          '[&>blockquote]:border-border',
          '[&>blockquote]:pl-4',
          '[&>blockquote]:text-muted-foreground',
          '[&>h1]:text-2xl',
          '[&>h1]:font-semibold',
          '[&>h2]:text-xl',
          '[&>h2]:font-semibold',
          '[&>h3]:text-lg',
          '[&>h3]:font-semibold',
          '[&>ol]:list-decimal',
          '[&>ol]:pl-6',
          '[&>ul]:list-disc',
          '[&>ul]:pl-6',
          '[&>pre]:overflow-x-auto',
          '[&>pre]:rounded-md',
          '[&>pre]:border',
          '[&>pre]:border-border',
          '[&>pre]:bg-background',
          '[&>pre]:p-3',
          '[&>table]:w-full',
          '[&>table]:border-collapse',
          '[&>table_th]:border',
          '[&>table_th]:border-border',
          '[&>table_th]:px-3',
          '[&>table_th]:py-2',
          '[&>table_th]:text-left',
          '[&>table_td]:border',
          '[&>table_td]:border-border',
          '[&>table_td]:px-3',
          '[&>table_td]:py-2',
          '[&>*+*]:mt-3',
        ].join(' ')}
      >
        {text}
      </Streamdown>
      {state !== 'streaming' ? <WorkspaceFileReferences text={text} /> : null}
    </>
  );
});
