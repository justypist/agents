import { createOpenAI, OpenAILanguageModelResponsesOptions } from '@ai-sdk/openai';

import { config } from '@/config';

const openai = createOpenAI({
  baseURL: config.ai.baseUrl,
  apiKey: config.ai.apiKey,
});

const model = {
  chat: openai.responses(config.ai.model.chat),
  small: openai.responses(config.ai.model.small),
  image: openai.imageModel(config.ai.model.image),
};

const serviceTierOptions: OpenAILanguageModelResponsesOptions = {
  serviceTier: 'priority',
}

const codexOptions: OpenAILanguageModelResponsesOptions = {
  store: false,
}

const chatOptions: OpenAILanguageModelResponsesOptions = {
  promptCacheKey: 'agents',
  promptCacheRetention: '24h',
  forceReasoning: true,
  parallelToolCalls: true,
  textVerbosity: 'medium',
  reasoningEffort: 'high',
  reasoningSummary: 'auto',
  include: ['reasoning.encrypted_content'],
}

const commonOpenaiOptions: OpenAILanguageModelResponsesOptions = {
  ...serviceTierOptions,
  ...codexOptions,
}

export const options = {
  chat: {
    model: model.chat,
    providerOptions: {
      openai: {
        ...commonOpenaiOptions,
        ...chatOptions,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
  small: {
    model: model.small,
    providerOptions: {
      openai: {
        ...commonOpenaiOptions,
        ...chatOptions,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
  image: {
    model: model.image,
    providerOptions: {
      openai: {
        ...commonOpenaiOptions,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  },
};
