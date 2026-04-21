import { tavily } from '@tavily/core';
import { config } from '@/config';

const tavilyClients = config.tavily.apiKeys.map(apiKey => tavily({ apiKey }));

let clientIndex = 0;

export function getTavilyClient() {
  if (tavilyClients.length === 0) {
    throw new Error('未配置 Tavily API key');
  }

  const client = tavilyClients[clientIndex % tavilyClients.length];
  clientIndex = (clientIndex + 1) % tavilyClients.length;
  return client;
}
