const IMAGE_CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

const TEXT_CONTENT_TYPES: Record<string, string> = {
  cjs: TEXT_CONTENT_TYPE,
  css: TEXT_CONTENT_TYPE,
  csv: TEXT_CONTENT_TYPE,
  env: TEXT_CONTENT_TYPE,
  gitignore: TEXT_CONTENT_TYPE,
  htm: TEXT_CONTENT_TYPE,
  html: TEXT_CONTENT_TYPE,
  ini: TEXT_CONTENT_TYPE,
  js: TEXT_CONTENT_TYPE,
  json: TEXT_CONTENT_TYPE,
  jsx: TEXT_CONTENT_TYPE,
  log: TEXT_CONTENT_TYPE,
  markdown: TEXT_CONTENT_TYPE,
  md: TEXT_CONTENT_TYPE,
  mjs: TEXT_CONTENT_TYPE,
  sql: TEXT_CONTENT_TYPE,
  toml: TEXT_CONTENT_TYPE,
  ts: TEXT_CONTENT_TYPE,
  tsx: TEXT_CONTENT_TYPE,
  tsv: TEXT_CONTENT_TYPE,
  txt: TEXT_CONTENT_TYPE,
  xml: TEXT_CONTENT_TYPE,
  yaml: TEXT_CONTENT_TYPE,
  yml: TEXT_CONTENT_TYPE,
};

const TEXT_FILENAMES = new Set([
  'dockerfile',
  'makefile',
  'readme',
  '.dockerignore',
  '.editorconfig',
  '.env',
  '.eslintrc',
  '.gitignore',
  '.npmrc',
  '.prettierrc',
]);

export type WorkspacePreviewKind = 'image' | 'text' | null;

function getWorkspaceFileBasename(filename: string | undefined): string | null {
  return filename?.split(/[\\/]/).pop()?.toLowerCase() ?? null;
}

export function getWorkspaceFileExtension(filename: string | undefined): string | null {
  const basename = getWorkspaceFileBasename(filename);
  const extension = basename?.split('.').pop();

  return extension != null && extension !== basename ? extension : null;
}

export function getWorkspaceFileContentType(filename: string): string | null {
  const basename = getWorkspaceFileBasename(filename);

  if (basename != null && TEXT_FILENAMES.has(basename)) {
    return TEXT_CONTENT_TYPE;
  }

  const extension = getWorkspaceFileExtension(filename);

  if (extension == null) {
    return null;
  }

  return IMAGE_CONTENT_TYPES[extension] ?? TEXT_CONTENT_TYPES[extension] ?? null;
}

export function getWorkspacePreviewKind(filename: string | undefined): WorkspacePreviewKind {
  const basename = getWorkspaceFileBasename(filename);

  if (basename != null && TEXT_FILENAMES.has(basename)) {
    return 'text';
  }

  const extension = getWorkspaceFileExtension(filename);

  if (extension == null) {
    return null;
  }

  if (IMAGE_CONTENT_TYPES[extension] != null) {
    return 'image';
  }

  if (TEXT_CONTENT_TYPES[extension] != null) {
    return 'text';
  }

  return null;
}

export function isTextMediaType(mediaType: string | undefined): boolean {
  if (mediaType == null) {
    return false;
  }

  return (
    mediaType.startsWith('text/') ||
    mediaType === 'application/json' ||
    mediaType === 'application/xml' ||
    mediaType.endsWith('+json') ||
    mediaType.endsWith('+xml')
  );
}
