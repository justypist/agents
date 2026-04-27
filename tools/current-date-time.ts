import { jsonSchema, tool } from 'ai';

type CurrentDateTimeResult = {
  iso: string;
  locale: string;
  timezone: string;
  timestamp: number;
};

const currentDateTimeInputSchema = jsonSchema<Record<string, never>>({
  type: 'object',
  properties: {},
  additionalProperties: false,
});

export const currentDateTime = tool({
  description:
    '获取当前日期时间；涉及新闻、价格、产品状态、版本、政策、论文进展、活动时间等可能随时间变化的信息时，应先用它确认当前时间，再判断是否需要继续核实',
  inputSchema: currentDateTimeInputSchema,
  execute: async (): Promise<CurrentDateTimeResult> => {
    const now = new Date();

    return {
      iso: now.toISOString(),
      locale: new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      }).format(now),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: now.getTime(),
    };
  },
});
