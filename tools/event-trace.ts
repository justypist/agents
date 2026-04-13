import { jsonSchema, tool } from 'ai';

type EventTraceInput = {
  event: string;
  maxRounds?: number;
  maxCharactersPerRound?: number;
};

type TimelineItem = {
  date: string;
  summary: string;
  source?: string;
};

type RoundResult = {
  round: number;
  query: string;
  searchUrl: string;
  extractedEarliestDate?: string;
  notes: string[];
};

type EventTraceResult = {
  event: string;
  rounds: RoundResult[];
  earliestDateFound?: string;
  timeline: TimelineItem[];
  conclusion: string;
};

const eventTraceInputSchema = jsonSchema<EventTraceInput>({
  type: 'object',
  properties: {
    event: {
      type: 'string',
      description: '要追溯的事件描述，例如“某公司数据泄露事件”',
    },
    maxRounds: {
      type: 'integer',
      minimum: 1,
      maximum: 8,
      description: '最多搜索轮次，默认 4',
    },
    maxCharactersPerRound: {
      type: 'integer',
      minimum: 3000,
      maximum: 40000,
      description: '每轮最多读取搜索结果字符数，默认 12000',
    },
  },
  required: ['event'],
});

const DATE_PATTERN = /((?:19|20)\d{2}[./-](?:0?[1-9]|1[0-2])[./-](?:0?[1-9]|[12]\d|3[01]))|((?:19|20)\d{2}年(?:0?[1-9]|1[0-2])月(?:0?[1-9]|[12]\d|3[01])日)|((?:19|20)\d{2}年(?:0?[1-9]|1[0-2])月)|((?:19|20)\d{2})/g;

function clampRounds(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 4;
  }

  return Math.min(Math.max(Math.floor(value), 1), 8);
}

function clampChars(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 12000;
  }

  return Math.min(Math.max(Math.floor(value), 3000), 40000);
}

function normalizeDate(rawDate: string): string {
  if (/^\d{4}$/.test(rawDate)) {
    return `${rawDate}-01-01`;
  }

  const monthOnly = rawDate.match(/^(\d{4})年(\d{1,2})月$/);
  if (monthOnly) {
    return `${monthOnly[1]}-${monthOnly[2].padStart(2, '0')}-01`;
  }

  const zh = rawDate.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (zh) {
    return `${zh[1]}-${zh[2].padStart(2, '0')}-${zh[3].padStart(2, '0')}`;
  }

  const sep = rawDate.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (sep) {
    return `${sep[1]}-${sep[2].padStart(2, '0')}-${sep[3].padStart(2, '0')}`;
  }

  return rawDate;
}

function extractDates(text: string): string[] {
  const matches = text.match(DATE_PATTERN) ?? [];
  const normalizedDates = matches
    .map(item => normalizeDate(item.trim()))
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item));

  return Array.from(new Set(normalizedDates)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function extractTopLines(text: string, limit: number): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => /\d{4}|http|https|发布|报道|声明|调查|起因|经过|结果/.test(line))
    .slice(0, limit);
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  const cleaned = matches.map(url => url.replace(/[),.;!?]+$/, ''));

  return Array.from(new Set(cleaned)).slice(0, 8);
}

function buildQueries(event: string, earliestDate?: string): string[] {
  const base = [
    `${event} 时间线 起因 经过 结果`,
    `${event} 最早 报道`,
    `${event} 官方 通报 声明 时间`,
    `${event} 复盘 时间轴`,
  ];

  if (earliestDate) {
    const year = earliestDate.slice(0, 4);
    base.unshift(`${event} ${year} 最初 报道 起源`);
  }

  return base;
}

async function searchWithJina(
  query: string,
  maxChars: number,
  abortSignal?: AbortSignal,
): Promise<{ searchUrl: string; text: string }> {
  const searchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl, {
    signal:
      abortSignal == null
        ? AbortSignal.timeout(30000)
        : AbortSignal.any([abortSignal, AbortSignal.timeout(30000)]),
  });

  if (!response.ok) {
    throw new Error(`搜索失败: ${response.status} ${response.statusText}`);
  }

  const content = (await response.text()).trim();

  return {
    searchUrl,
    text: content.slice(0, maxChars),
  };
}

export const eventTraceTool = tool({
  description:
    '输入一个事件，自动进行多轮全网检索并尽量从最早时间点追溯原委，输出来龙去脉与时间线。',
  inputSchema: eventTraceInputSchema,
  execute: async (
    { event, maxRounds, maxCharactersPerRound },
    { abortSignal },
  ): Promise<EventTraceResult> => {
    const normalizedEvent = event.trim();

    if (normalizedEvent.length === 0) {
      throw new Error('event 不能为空');
    }

    const roundsLimit = clampRounds(maxRounds);
    const charsLimit = clampChars(maxCharactersPerRound);

    const rounds: RoundResult[] = [];
    const aggregatedDates = new Set<string>();
    const timeline: TimelineItem[] = [];
    let earliestDateFound: string | undefined;

    const queries = buildQueries(normalizedEvent);

    for (let index = 0; index < roundsLimit; index += 1) {
      const query = queries[index] ?? `${normalizedEvent} 时间线 第${index + 1}轮 检索`;
      const { searchUrl, text } = await searchWithJina(query, charsLimit, abortSignal);
      const dates = extractDates(text);
      const urls = extractUrls(text);
      const topLines = extractTopLines(text, 6);

      for (const date of dates) {
        aggregatedDates.add(date);
      }

      const currentEarliest = Array.from(aggregatedDates).sort((a, b) =>
        a.localeCompare(b),
      )[0];

      if (currentEarliest != null && currentEarliest !== earliestDateFound) {
        earliestDateFound = currentEarliest;
        const nextQueries = buildQueries(normalizedEvent, earliestDateFound);
        queries.splice(0, queries.length, ...nextQueries);
      }

      rounds.push({
        round: index + 1,
        query,
        searchUrl,
        extractedEarliestDate: dates[0],
        notes: topLines,
      });

      if (dates[0] != null && topLines[0] != null) {
        timeline.push({
          date: dates[0],
          summary: topLines[0],
          source: urls[0],
        });
      }

      if (earliestDateFound != null && index >= 2 && dates.includes(earliestDateFound)) {
        break;
      }
    }

    const sortedTimeline = timeline
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);

    const conclusion =
      earliestDateFound == null
        ? '未能稳定识别明确日期，请结合更多来源进行人工核验。'
        : `目前检索到的最早时间点是 ${earliestDateFound}，已按时间顺序整理关键节点。`;

    return {
      event: normalizedEvent,
      rounds,
      earliestDateFound,
      timeline: sortedTimeline,
      conclusion,
    };
  },
});
