import { jsonSchema, tool } from 'ai';

type CrawlInput = {
  url: string;
  maxCharacters?: number;
};

type CrawlResult = {
  url: string;
  jinaUrl: string;
  content: string;
  truncated: boolean;
};

const crawlInputSchema = jsonSchema<CrawlInput>({
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description: '要抓取的网页 URL，必须是 http 或 https 地址',
    },
    maxCharacters: {
      type: 'integer',
      description: '返回内容的最大字符数，默认 12000，最大 20000',
      minimum: 1000,
      maximum: 20000,
    },
  },
  required: ['url'],
});

function normalizeUrl(value: string): string {
  const trimmedValue = value.trim();
  const parsedUrl = new URL(trimmedValue);

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('仅支持 http 或 https URL');
  }

  return parsedUrl.toString();
}

function clampMaxCharacters(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 12000;
  }

  return Math.min(Math.max(Math.floor(value), 1000), 20000);
}

export const crawl = tool({
  description:
    '抓取指定网页正文内容，适合已有明确 URL、搜索结果或用户输入中提供可核验链接时读取来源详情、核验细节、摘取原文表述或补足 Source。优先选择权威来源 URL，例如公司官网、监管机构、临床试验登记平台、期刊原文页、新闻稿或可信数据库页面；不要把低可信聚合页作为唯一证据',
  inputSchema: crawlInputSchema,
  execute: async (
    { url, maxCharacters },
    { abortSignal },
  ): Promise<CrawlResult> => {
    const normalizedUrl = normalizeUrl(url);
    const responseUrl = `https://r.jina.ai/${normalizedUrl}`;
    const response = await fetch(responseUrl, {
      signal:
        abortSignal == null
          ? AbortSignal.timeout(20000)
          : AbortSignal.any([abortSignal, AbortSignal.timeout(20000)]),
    });

    if (!response.ok) {
      throw new Error(`抓取失败: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    const limitedLength = clampMaxCharacters(maxCharacters);
    const normalizedContent = content.trim();
    const truncatedContent = normalizedContent.slice(0, limitedLength);

    return {
      url: normalizedUrl,
      jinaUrl: responseUrl,
      content: truncatedContent,
      truncated: normalizedContent.length > truncatedContent.length,
    };
  },
});
