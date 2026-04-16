import { type TavilySearchOptions, type TavilySearchResponse } from '@tavily/core';
import { jsonSchema, tool } from 'ai';
import { tvly } from '@/lib/tavily';

const DEFAULT_MAX_RESULTS = 4;
const MAX_MAX_RESULTS = 10;
const DEFAULT_TOPIC = 'general' as const;
const DEFAULT_SEARCH_DEPTH = 'basic' as const;
const DEFAULT_INCLUDE_ANSWER = true;
const DEFAULT_INCLUDE_RAW_CONTENT = false;
const MAX_CONTENT_CHARS = 1200;
const MAX_RAW_CONTENT_CHARS = 2000;
const MAX_IMAGES = 4;

type TavilySearchToolInput = {
  query: string;
  maxResults?: number;
  topic?: 'general' | 'news' | 'finance';
  searchDepth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  includeAnswer?: boolean;
  includeRawContent?: false | 'markdown' | 'text';
  includeDomains?: string[];
  excludeDomains?: string[];
  days?: number;
};

type TavilySearchToolResult = Pick<
  TavilySearchResponse,
  'query' | 'answer' | 'responseTime' | 'results' | 'images' | 'requestId'
>;

const tavilySearchInputSchema = jsonSchema<TavilySearchToolInput>({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: '搜索关键词或问题',
    },
    maxResults: {
      type: 'integer',
      description: `返回结果数量，默认 ${DEFAULT_MAX_RESULTS}，最大 ${MAX_MAX_RESULTS}`,
      minimum: 1,
      maximum: MAX_MAX_RESULTS,
    },
    topic: {
      type: 'string',
      description: '搜索主题，默认 general',
      enum: ['general', 'news', 'finance'],
    },
    searchDepth: {
      type: 'string',
      description: '搜索深度，默认 basic',
      enum: ['basic', 'advanced', 'fast', 'ultra-fast'],
    },
    includeAnswer: {
      type: 'boolean',
      description: '是否返回 Tavily 生成的简短答案，默认 true',
    },
    includeRawContent: {
      oneOf: [
        {
          type: 'boolean',
          enum: [false],
          description: '不返回原始正文',
        },
        {
          type: 'string',
          enum: ['markdown', 'text'],
          description: '返回原始正文格式',
        },
      ],
      description: '是否附带原始正文，默认 false',
    },
    includeDomains: {
      type: 'array',
      description: '仅搜索这些域名',
      items: {
        type: 'string',
      },
    },
    excludeDomains: {
      type: 'array',
      description: '排除这些域名',
      items: {
        type: 'string',
      },
    },
    days: {
      type: 'integer',
      description: '仅在 topic=news 时限制最近天数',
      minimum: 1,
    },
  },
  required: ['query'],
});

function clampMaxResults(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(Math.max(Math.floor(value), 1), MAX_MAX_RESULTS);
}

function normalizeQuery(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new Error('query 不能为空');
  }

  return normalizedValue;
}

function normalizeDomains(value?: string[]): string[] | undefined {
  if (value == null) {
    return undefined;
  }

  const normalizedDomains = value
    .map(item => item.trim())
    .filter(item => item.length > 0);

  return normalizedDomains.length > 0 ? Array.from(new Set(normalizedDomains)) : undefined;
}

function truncateText(value: string | undefined, maxChars: number): string | undefined {
  if (value == null || value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}…`;
}

function buildSearchOptions(input: TavilySearchToolInput): TavilySearchOptions {
  return {
    maxResults: clampMaxResults(input.maxResults),
    topic: input.topic ?? DEFAULT_TOPIC,
    searchDepth: input.searchDepth ?? DEFAULT_SEARCH_DEPTH,
    includeAnswer: input.includeAnswer ?? DEFAULT_INCLUDE_ANSWER,
    includeRawContent: input.includeRawContent ?? DEFAULT_INCLUDE_RAW_CONTENT,
    includeDomains: normalizeDomains(input.includeDomains),
    excludeDomains: normalizeDomains(input.excludeDomains),
    days: input.days,
  };
}

export const tavilySearchTool = tool({
  description: '使用 Tavily 执行联网搜索，返回答案摘要、候选来源和裁剪后的网页片段',
  inputSchema: tavilySearchInputSchema,
  execute: async (input): Promise<TavilySearchToolResult> => {
    const response = await tvly.search(normalizeQuery(input.query), buildSearchOptions(input));

    return {
      query: response.query,
      answer: truncateText(response.answer, 800),
      responseTime: response.responseTime,
      results: response.results.map(result => ({
        ...result,
        content: truncateText(result.content, MAX_CONTENT_CHARS) ?? '',
        rawContent: truncateText(result.rawContent, MAX_RAW_CONTENT_CHARS),
      })),
      images: response.images.slice(0, MAX_IMAGES),
      requestId: response.requestId,
    };
  },
});
