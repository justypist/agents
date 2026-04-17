import { LanguageModel } from 'ai'
import { createOpenAI, OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai';

import { config } from '@/config';

const openai = createOpenAI({
  baseURL: config.ai.baseUrl,
  apiKey: config.ai.apiKey,
});

let model: LanguageModel;

switch (config.ai.method) {
  case "responses":
    model = openai.responses(config.ai.model);
  case "chat-completions":
  default:
    model = openai.chat(config.ai.model);
}

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
