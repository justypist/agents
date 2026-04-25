import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  generateImage as generateImageWithAi,
  jsonSchema,
  tool,
  type GeneratedFile,
  type GenerateImageResult,
} from 'ai';

import { config } from '@/config';
import {
  ensureWorkspaceRoot,
  toVirtualWorkspacePath,
  toWorkspacePath,
} from '@/lib/exec-runtime';
import { options } from '@/lib/ai';

const DEFAULT_IMAGE_COUNT = 1;
const MAX_IMAGE_COUNT = 3;
const OUTPUT_DIRECTORY = 'generated-images';

type AiGenerateImageInput = Parameters<typeof generateImageWithAi>[0];
type ImageSize = 'auto' | '1024x1024' | '1024x1536' | '1536x1024';
type ImageQuality = 'auto' | 'low' | 'medium' | 'high';
type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
type ImageBackground = 'auto' | 'opaque' | 'transparent';

export type GenerateImageToolInput = {
  prompt: string;
  n?: number;
  size?: ImageSize;
  quality?: ImageQuality;
  outputFormat?: ImageOutputFormat;
  background?: ImageBackground;
  outputCompression?: number;
};

type GeneratedImageFile = {
  path: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
};

type GenerateImageToolResult = {
  model: string;
  prompt: string;
  files: GeneratedImageFile[];
  revisedPrompts: string[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

const generateImageInputSchema = jsonSchema<GenerateImageToolInput>({
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description: '图片生成提示词，尽量明确主体、风格、构图、文字要求和限制',
    },
    n: {
      type: 'integer',
      description: `生成图片数量，默认 ${DEFAULT_IMAGE_COUNT}，最大 ${MAX_IMAGE_COUNT}`,
      minimum: 1,
      maximum: MAX_IMAGE_COUNT,
    },
    size: {
      type: 'string',
      description: '图片尺寸，默认由模型决定',
      enum: ['auto', '1024x1024', '1024x1536', '1536x1024'],
    },
    quality: {
      type: 'string',
      description: '生成质量，默认由模型决定',
      enum: ['auto', 'low', 'medium', 'high'],
    },
    outputFormat: {
      type: 'string',
      description: '输出格式，默认由模型决定',
      enum: ['png', 'jpeg', 'webp'],
    },
    background: {
      type: 'string',
      description: '背景类型，默认由模型决定',
      enum: ['auto', 'opaque', 'transparent'],
    },
    outputCompression: {
      type: 'integer',
      description: '输出压缩质量，0-100，仅在模型支持时生效',
      minimum: 0,
      maximum: 100,
    },
  },
  required: ['prompt'],
  additionalProperties: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

function getStringProperty(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizePrompt(value: string): string {
  const prompt = value.trim();

  if (prompt.length === 0) {
    throw new Error('prompt 不能为空');
  }

  return prompt;
}

function normalizeImageCount(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_IMAGE_COUNT;
  }

  return Math.min(Math.max(Math.floor(value), 1), MAX_IMAGE_COUNT);
}

function normalizeOutputCompression(value?: number): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }

  return Math.min(Math.max(Math.floor(value), 0), 100);
}

function getSdkSize(size: ImageSize | undefined): AiGenerateImageInput['size'] {
  return size === 'auto' ? undefined : size;
}

function getProviderOptions(input: GenerateImageToolInput): AiGenerateImageInput['providerOptions'] {
  const outputCompression = normalizeOutputCompression(input.outputCompression);

  return {
    ...options.image.providerOptions,
    openai: {
      ...options.image.providerOptions.openai,
      ...(input.size === 'auto' ? { size: input.size } : {}),
      ...(input.quality != null ? { quality: input.quality } : {}),
      ...(input.background != null ? { background: input.background } : {}),
      ...(input.outputFormat != null ? { output_format: input.outputFormat } : {}),
      ...(outputCompression != null ? { output_compression: outputCompression } : {}),
    },
  };
}

function extensionFromMediaType(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
    default:
      return 'png';
  }
}

function parseUsage(usage: GenerateImageResult['usage']): GenerateImageToolResult['usage'] {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}

function collectRevisedPrompts(providerMetadata: GenerateImageResult['providerMetadata']): string[] {
  const openai = providerMetadata.openai;

  if (!isRecord(openai) || !Array.isArray(openai.images)) {
    return [];
  }

  return openai.images
    .map(item => (isRecord(item) ? getStringProperty(item, 'revisedPrompt') : undefined))
    .filter(revisedPrompt => revisedPrompt != null);
}

async function saveGeneratedImage(
  image: GeneratedFile,
  index: number,
): Promise<GeneratedImageFile> {
  const buffer = Buffer.from(image.uint8Array);
  const extension = extensionFromMediaType(image.mediaType);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${index + 1}.${extension}`;
  const workspaceDirectory = toWorkspacePath(OUTPUT_DIRECTORY);
  const workspacePath = path.posix.join(OUTPUT_DIRECTORY, filename);

  await ensureWorkspaceRoot();
  await mkdir(workspaceDirectory, { recursive: true });
  await writeFile(toWorkspacePath(workspacePath), buffer);

  return {
    path: toVirtualWorkspacePath(workspacePath),
    filename,
    mediaType: image.mediaType,
    sizeBytes: buffer.byteLength,
  };
}

export async function executeGenerateImage(
  input: GenerateImageToolInput,
): Promise<GenerateImageToolResult> {
  const prompt = normalizePrompt(input.prompt);
  const result = await generateImageWithAi({
    ...options.image,
    prompt,
    n: normalizeImageCount(input.n),
    size: getSdkSize(input.size),
    providerOptions: getProviderOptions(input),
  });
  const files = await Promise.all(
    result.images.map((image, index) => saveGeneratedImage(image, index)),
  );

  return {
    model: result.responses[0]?.modelId ?? config.ai.model.image,
    prompt,
    files,
    revisedPrompts: collectRevisedPrompts(result.providerMetadata),
    usage: parseUsage(result.usage),
  };
}

export const generateImage = tool({
  description:
    '调用 AI SDK generateImage 生成图片，并将结果保存到 /workspace/generated-images，返回可预览/下载的文件路径',
  inputSchema: generateImageInputSchema,
  execute: async input => executeGenerateImage(input),
});
