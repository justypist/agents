import { tavily } from '@tavily/core';
import { config } from '@/config';

export const tvly = tavily({ apiKey: config.tavily.apiKey });
