import { openai } from '@/lib/ai';

export const searchTool = openai.tools.webSearch({
  externalWebAccess: true,
  searchContextSize: 'high',
});
