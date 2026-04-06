import { openai } from '@ai-sdk/openai'

export const webSearch = openai.tools.webSearch({
  externalWebAccess: true,
  searchContextSize: 'high',
})
