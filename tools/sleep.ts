import { jsonSchema, tool } from 'ai';

const DEFAULT_SECONDS = 5;
const MAX_SECONDS = 30;

type SleepToolInput = {
  seconds?: number;
  reason?: string;
};

type SleepToolResult = {
  reason?: string;
  requestedSeconds: number;
  sleptMilliseconds: number;
  startedAt: string;
  finishedAt: string;
};

const sleepInputSchema = jsonSchema<SleepToolInput>({
  type: 'object',
  properties: {
    seconds: {
      type: 'integer',
      description: `等待秒数，默认 ${DEFAULT_SECONDS}，最大 ${MAX_SECONDS}`,
      minimum: 1,
      maximum: MAX_SECONDS,
    },
    reason: {
      type: 'string',
      description: '等待原因，比如 PubMed 429 限流',
    },
  },
  additionalProperties: false,
});

function normalizeSeconds(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_SECONDS;
  }

  return Math.min(Math.max(Math.floor(value), 1), MAX_SECONDS);
}

async function waitForDelay(milliseconds: number): Promise<void> {
  await new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

export const sleep = tool({
  description: '等待一段时间后再继续，适合处理 429 限流、短暂退避或顺序重试',
  inputSchema: sleepInputSchema,
  execute: async (input): Promise<SleepToolResult> => {
    const seconds = normalizeSeconds(input.seconds);
    const milliseconds = seconds * 1000;
    const startedAt = new Date();

    await waitForDelay(milliseconds);

    return {
      reason: input.reason?.trim() || undefined,
      requestedSeconds: seconds,
      sleptMilliseconds: milliseconds,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
  },
});
