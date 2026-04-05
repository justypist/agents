import { createOpenAI, OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai';

import { config } from '@/config';

export const openai = createOpenAI({
  baseURL: config.ai.baseUrl,
  apiKey: config.ai.apiKey,
});

export const model = openai.responses(config.ai.model);

export const options = {
  model,
  providerOptions: {
    openai: {
      store: false,
      forceReasoning: true,
      parallelToolCalls: true,
      textVerbosity: 'medium',
      reasoningEffort: 'medium',
      reasoningSummary: 'auto',
      include: ['reasoning.encrypted_content']
    } satisfies OpenAILanguageModelResponsesOptions,
  },
};
