import { createOpenAI } from '@ai-sdk/openai';

import { config } from '@/config'

export const openai = createOpenAI({
  baseURL: config.ai.baseUrl,
  apiKey: config.ai.apiKey,
});

export const model = openai.responses(config.ai.model)