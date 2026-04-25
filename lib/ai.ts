import { createOpenAI, OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai';

import { config } from '@/config';

const openai = createOpenAI({
  baseURL: config.ai.baseUrl,
  apiKey: config.ai.apiKey,
});

const model = {
  chat: openai.responses(config.ai.model.chat),
  small: openai.responses(config.ai.model.small),
  image: openai.image(config.ai.model.image),
};

export const options = {
  chat: {
    model: model.chat,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        parallelToolCalls: true,
        textVerbosity: 'medium',
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        include: ['reasoning.encrypted_content'],
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
  small: {
    model: model.small,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        parallelToolCalls: true,
        textVerbosity: 'medium',
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        include: ['reasoning.encrypted_content'],
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
  image: {
    model: model.image,
  },
};
