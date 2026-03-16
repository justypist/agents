import { wrapProvider } from 'ai';
import { createOpenAI, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { config } from '@/config';

export const openaiProvider = createOpenAI({
  baseURL: config.ai.baseURL,
  apiKey: config.ai.apiKey,
});

const wrappedOpenAIProvider = wrapProvider({
  provider: openaiProvider,
  languageModelMiddleware: config.env === 'development' ? [devToolsMiddleware()] : [],
});

export const model = wrappedOpenAIProvider.languageModel(config.ai.model.language);

export const options = {
  model,
  providerOptions: {
    openai: {
      store: false,
      include: ['reasoning.encrypted_content'],
    } satisfies OpenAIResponsesProviderOptions,
  },
};
