import { jsonSchema, tool } from 'ai';

import { executeTavilySearch, type TavilySearchToolInput } from '@/tools/tavily';

const DEFAULT_MAX_RESULTS = 4;
const MAX_MAX_RESULTS = 10;
const PUBMED_DOMAIN = 'pubmed.ncbi.nlm.nih.gov';

type PubmedSearchToolInput = Omit<TavilySearchToolInput, 'includeDomains'>;

const pubmedSearchInputSchema = jsonSchema<PubmedSearchToolInput>({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'PubMed 搜索关键词、疾病、药物、作者或问题',
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
    excludeDomains: {
      type: 'array',
      description: '额外排除的域名；默认仅搜索 PubMed 域名',
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

export const pubmedSearchTool = tool({
  description: '搜索 PubMed，仅返回 pubmed.ncbi.nlm.nih.gov 域名下的结果',
  inputSchema: pubmedSearchInputSchema,
  execute: async input =>
    executeTavilySearch({
      ...input,
      includeDomains: [PUBMED_DOMAIN],
    }),
});

