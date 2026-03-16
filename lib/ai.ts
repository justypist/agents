import { wrapLanguageModel } from 'ai';
import { createOpenAI, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { config } from '@/config';

export const openaiProvider = createOpenAI({
  baseURL: config.ai.baseURL,
  apiKey: config.ai.apiKey,
});

export const model = wrapLanguageModel({
  model: openaiProvider.responses(config.ai.model.language),
  middleware: config.env === 'development' ? devToolsMiddleware() : [],
});

export const options = {
  model,
  providerOptions: {
    openai: {
      store: false,
      include: ['reasoning.encrypted_content'],
    } satisfies OpenAIResponsesProviderOptions,
  },
};
