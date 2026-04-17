import { jsonSchema, tool } from 'ai';
import { ProxyAgent } from 'undici';

import { config } from '@/config';
import { getProxyURL } from '@/lib/webshare';

const PUBMED_EUTILS_BASE_URL =
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const PUBMED_WEB_BASE_URL = 'https://pubmed.ncbi.nlm.nih.gov';
const DEFAULT_MAX_RESULTS = 5;
const MAX_MAX_RESULTS = 10;
const DEFAULT_SORT = 'pub_date' as const;
const MAX_ABSTRACT_CHARS = 2400;
const pubmedProxyAgents = new Map<string, ProxyAgent>();

type PubmedSearchSort = 'relevance' | 'pub_date' | 'author' | 'journal';

type PubmedSearchToolInput = {
  query: string;
  maxResults?: number;
  sort?: PubmedSearchSort;
  dateFrom?: string;
  dateTo?: string;
  includeAbstracts?: boolean;
};

type PubmedAuthorSummary = {
  name?: string;
};

type PubmedArticleIdSummary = {
  idtype?: string;
  value?: string;
};

type PubmedSummaryRecord = {
  uid: string;
  title?: string;
  pubdate?: string;
  epubdate?: string;
  source?: string;
  fulljournalname?: string;
  authors?: PubmedAuthorSummary[];
  lang?: string[];
  pubtype?: string[];
  articleids?: PubmedArticleIdSummary[];
};

type PubmedSearchResponse = {
  esearchresult: {
    count: string;
    querytranslation?: string;
    idlist: string[];
  };
};

type PubmedSummaryResponse = {
  result: Record<string, PubmedSummaryRecord | string[]>;
};

type PubmedArticleDetails = {
  abstract?: string;
  pmcid?: string;
};

type PubmedArticle = {
  pmid: string;
  title: string;
  journal: string;
  publicationDate?: string;
  electronicPublicationDate?: string;
  authors: string[];
  publicationTypes: string[];
  languages: string[];
  doi?: string;
  pmcid?: string;
  abstract?: string;
  url: string;
};

type PubmedSearchToolResult = {
  source: 'pubmed';
  query: string;
  translatedQuery?: string;
  totalCount: number;
  returnedCount: number;
  retrievedAt: string;
  articles: PubmedArticle[];
};

type PubmedFetchResult = {
  response: Response;
  proxyURL: string | null;
};

const pubmedSearchInputSchema = jsonSchema<PubmedSearchToolInput>({
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description: 'PubMed 检索词，可包含疾病、靶点、药物、机构、作者或布尔查询',
    },
    maxResults: {
      type: 'integer',
      description: `返回文献数量，默认 ${DEFAULT_MAX_RESULTS}，最大 ${MAX_MAX_RESULTS}`,
      minimum: 1,
      maximum: MAX_MAX_RESULTS,
    },
    sort: {
      type: 'string',
      description: '排序方式，默认 pub_date',
      enum: ['relevance', 'pub_date', 'author', 'journal'],
    },
    dateFrom: {
      type: 'string',
      description: '起始发表日期，格式 YYYY-MM-DD',
    },
    dateTo: {
      type: 'string',
      description: '结束发表日期，格式 YYYY-MM-DD',
    },
    includeAbstracts: {
      type: 'boolean',
      description: '是否附带摘要，默认 true',
    },
  },
  required: ['query'],
});

export const pubmedSearch = tool({
  description:
    '直接调用 PubMed E-utilities 搜索文献，返回 PMID、标题、作者、期刊、日期、DOI、链接和可选摘要',
  inputSchema: pubmedSearchInputSchema,
  execute: async input => executePubmedSearch(input),
});

export async function executePubmedSearch(
  input: PubmedSearchToolInput,
): Promise<PubmedSearchToolResult> {
  const query = normalizeQuery(input.query);
  const maxResults = clampMaxResults(input.maxResults);
  const dateFrom = normalizeDate(input.dateFrom, 'dateFrom');
  const dateTo = normalizeDate(input.dateTo, 'dateTo');
  const includeAbstracts = input.includeAbstracts ?? true;
  const searchParams = createPubmedParams({
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: String(maxResults),
    sort: mapSort(input.sort ?? DEFAULT_SORT),
    ...(dateFrom != null || dateTo != null
      ? {
          datetype: 'pdat',
          mindate: dateFrom,
          maxdate: dateTo,
        }
      : {}),
  });
  const searchResponse = await fetchPubmedJson<PubmedSearchResponse>(
    'esearch.fcgi',
    searchParams,
  );
  const pmids = searchResponse.esearchresult.idlist;

  if (pmids.length === 0) {
    return {
      source: 'pubmed',
      query,
      translatedQuery: searchResponse.esearchresult.querytranslation,
      totalCount: Number.parseInt(searchResponse.esearchresult.count, 10) || 0,
      returnedCount: 0,
      retrievedAt: new Date().toISOString(),
      articles: [],
    };
  }

  const summaryParams = createPubmedParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'json',
  });
  const summaryResponse = await fetchPubmedJson<PubmedSummaryResponse>(
    'esummary.fcgi',
    summaryParams,
  );
  const articleDetails = includeAbstracts
    ? await fetchPubmedArticleDetails(pmids)
    : new Map<string, PubmedArticleDetails>();
  const articles = pmids
    .map(pmid => buildPubmedArticle(pmid, summaryResponse.result, articleDetails))
    .filter((article): article is PubmedArticle => article != null);

  return {
    source: 'pubmed',
    query,
    translatedQuery: searchResponse.esearchresult.querytranslation,
    totalCount: Number.parseInt(searchResponse.esearchresult.count, 10) || 0,
    returnedCount: articles.length,
    retrievedAt: new Date().toISOString(),
    articles,
  };
}

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

function normalizeDate(value: string | undefined, fieldName: string): string | undefined {
  if (value == null) {
    return undefined;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new Error(`${fieldName} 必须是 YYYY-MM-DD`);
  }

  return normalizedValue.replaceAll('-', '/');
}

function mapSort(sort: PubmedSearchSort): string {
  switch (sort) {
    case 'relevance':
      return 'relevance';
    case 'pub_date':
      return 'pub_date';
    case 'author':
      return 'Author';
    case 'journal':
      return 'JournalName';
    default:
      return DEFAULT_SORT;
  }
}

function createPubmedParams(
  values: Record<string, string | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value == null || value.length === 0) {
      continue;
    }

    params.set(key, value);
  }

  params.set('tool', config.pubmed.tool);

  if (config.pubmed.email.length > 0) {
    params.set('email', config.pubmed.email);
  }

  if (config.pubmed.apiKey.length > 0) {
    params.set('api_key', config.pubmed.apiKey);
  }

  return params;
}

async function fetchPubmedJson<T>(
  path: string,
  params: URLSearchParams,
): Promise<T> {
  const { response, proxyURL } = await fetchPubmed(
    `${PUBMED_EUTILS_BASE_URL}/${path}?${params.toString()}`,
    {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    },
  );
  const contentType = response.headers.get('content-type') ?? '';
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      formatPubmedResponseError({
        message: `PubMed 请求失败: ${response.status} ${response.statusText}`,
        path,
        contentType,
        bodyText,
        proxyURL,
      }),
    );
  }

  if (!contentType.toLowerCase().includes('json')) {
    throw new Error(
      formatPubmedResponseError({
        message: 'PubMed 返回了非 JSON 响应',
        path,
        contentType,
        bodyText,
        proxyURL,
      }),
    );
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(
      formatPubmedResponseError({
        message: 'PubMed JSON 解析失败',
        path,
        contentType,
        bodyText,
        proxyURL,
      }),
    );
  }
}

async function fetchPubmedArticleDetails(
  pmids: string[],
): Promise<Map<string, PubmedArticleDetails>> {
  const { response, proxyURL } = await fetchPubmed(
    `${PUBMED_EUTILS_BASE_URL}/efetch.fcgi?${createPubmedParams({
      db: 'pubmed',
      id: pmids.join(','),
      retmode: 'xml',
    }).toString()}`,
    {
      cache: 'no-store',
      headers: {
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    },
  );
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      formatPubmedResponseError({
        message: `PubMed 摘要请求失败: ${response.status} ${response.statusText}`,
        path: 'efetch.fcgi',
        contentType,
        bodyText,
        proxyURL,
      }),
    );
  }

  const xml = await response.text();

  if (contentType.toLowerCase().includes('html')) {
    throw new Error(
      formatPubmedResponseError({
        message: 'PubMed 摘要接口返回了 HTML 响应',
        path: 'efetch.fcgi',
        contentType,
        bodyText: xml,
        proxyURL,
      }),
    );
  }

  return parsePubmedArticleDetails(xml);
}

async function fetchPubmed(
  input: string | URL,
  init: RequestInit,
): Promise<PubmedFetchResult> {
  const proxyURL = getProxyURL();
  const dispatcher = proxyURL == null ? undefined : getOrCreatePubmedProxyAgent(proxyURL);
  const response = await fetch(input, {
    ...init,
    ...(dispatcher == null ? {} : { dispatcher }),
  });

  return {
    response,
    proxyURL,
  };
}

function formatPubmedResponseError({
  message,
  path,
  contentType,
  bodyText,
  proxyURL,
}: {
  message: string;
  path: string;
  contentType: string;
  bodyText: string;
  proxyURL: string | null;
}): string {
  const normalizedContentType = contentType.length > 0 ? contentType : 'unknown';
  const transport = proxyURL == null ? 'direct' : `proxy(${maskProxyURL(proxyURL)})`;
  const preview = sanitizeBodyPreview(bodyText);

  return `${message}; endpoint=${path}; content-type=${normalizedContentType}; transport=${transport}; body-preview=${preview}`;
}

function sanitizeBodyPreview(value: string): string {
  const preview = value.replace(/\s+/g, ' ').trim().slice(0, 240);
  return preview.length > 0 ? JSON.stringify(preview) : '"<empty>"';
}

function maskProxyURL(proxyURL: string): string {
  try {
    const url = new URL(proxyURL);
    const port = url.port.length > 0 ? `:${url.port}` : '';
    return `${url.protocol}//${url.hostname}${port}`;
  } catch {
    return '<invalid-proxy-url>';
  }
}

function getOrCreatePubmedProxyAgent(proxyURL: string): ProxyAgent {
  const existingAgent = pubmedProxyAgents.get(proxyURL);

  if (existingAgent != null) {
    return existingAgent;
  }

  const nextAgent = new ProxyAgent(proxyURL);
  pubmedProxyAgents.set(proxyURL, nextAgent);
  return nextAgent;
}

function parsePubmedArticleDetails(xml: string): Map<string, PubmedArticleDetails> {
  const articleDetails = new Map<string, PubmedArticleDetails>();
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);

  for (const match of articleMatches) {
    const articleXml = match[1];

    if (articleXml == null) {
      continue;
    }

    const pmid = extractFirstTagValue(articleXml, 'PMID');

    if (pmid == null) {
      continue;
    }

    const abstractSections = Array.from(
      articleXml.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g),
    )
      .map(([, attributes, content]) => {
        const text = cleanXmlText(content);

        if (text.length === 0) {
          return null;
        }

        const label = extractXmlAttribute(attributes, 'Label');
        return label != null && label.length > 0 ? `${label}: ${text}` : text;
      })
      .filter((section): section is string => section != null);
    const abstract =
      abstractSections.length > 0
        ? truncateText(abstractSections.join('\n'), MAX_ABSTRACT_CHARS)
        : undefined;
    const pmcid = extractArticleId(articleXml, 'pmc');

    articleDetails.set(pmid, {
      abstract,
      pmcid,
    });
  }

  return articleDetails;
}

function buildPubmedArticle(
  pmid: string,
  records: Record<string, PubmedSummaryRecord | string[]>,
  articleDetails: Map<string, PubmedArticleDetails>,
): PubmedArticle | null {
  const record = records[pmid];

  if (record == null || Array.isArray(record)) {
    return null;
  }

  const details = articleDetails.get(pmid);
  const doi = findArticleId(record.articleids, 'doi');

  return {
    pmid,
    title: cleanWhitespace(record.title),
    journal: cleanWhitespace(record.fulljournalname ?? record.source),
    publicationDate: cleanOptionalText(record.pubdate),
    electronicPublicationDate: cleanOptionalText(record.epubdate),
    authors: (record.authors ?? [])
      .map(author => cleanWhitespace(author.name))
      .filter((author): author is string => author.length > 0),
    publicationTypes: (record.pubtype ?? [])
      .map(item => cleanWhitespace(item))
      .filter((item): item is string => item.length > 0),
    languages: (record.lang ?? [])
      .map(item => cleanWhitespace(item))
      .filter((item): item is string => item.length > 0),
    doi,
    pmcid: details?.pmcid,
    abstract: details?.abstract,
    url: `${PUBMED_WEB_BASE_URL}/${pmid}/`,
  };
}

function findArticleId(
  articleIds: PubmedArticleIdSummary[] | undefined,
  idType: string,
): string | undefined {
  const articleId = articleIds?.find(item => item.idtype === idType)?.value;
  return cleanOptionalText(articleId);
}

function extractFirstTagValue(xml: string, tagName: string): string | undefined {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`));
  return match == null ? undefined : cleanXmlText(match[1]);
}

function extractArticleId(xml: string, idType: string): string | undefined {
  const match = xml.match(
    new RegExp(
      `<ArticleId\\b[^>]*IdType="${escapeRegExp(idType)}"[^>]*>([\\s\\S]*?)<\\/ArticleId>`,
    ),
  );
  return match == null ? undefined : cleanXmlText(match[1]);
}

function extractXmlAttribute(
  attributes: string,
  attributeName: string,
): string | undefined {
  const match = attributes.match(
    new RegExp(`${escapeRegExp(attributeName)}="([^"]*)"`, 'i'),
  );
  return match == null ? undefined : cleanXmlText(match[1]);
}

function cleanXmlText(value: string | undefined): string {
  if (value == null) {
    return '';
  }

  return cleanWhitespace(decodeXmlEntities(value.replace(/<[^>]+>/g, ' ')));
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hexValue: string) =>
      safeCodePointToString(Number.parseInt(hexValue, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimalValue: string) =>
      safeCodePointToString(Number.parseInt(decimalValue, 10)),
    )
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function safeCodePointToString(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '';
  }

  try {
    return String.fromCodePoint(value);
  } catch {
    return '';
  }
}

function cleanWhitespace(value: string | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const normalizedValue = cleanWhitespace(value);
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}…`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
