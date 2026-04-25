import { loadEnvConfig } from '@next/env';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

type AIMethod = 'responses' | 'chat-completions';

export const config = {
  ai: {
    baseUrl: process.env.AI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY?.trim() || 'sk-xxx',
    method: (process.env.AI_API_METHOD?.trim().toLowerCase() ||
      'responses') as AIMethod,
    model: {
      chat: process.env.AI_MODEL_CHAT?.trim() || 'gpt-5.5',
      small: process.env.AI_MODEL_SMALL?.trim() || 'gpt-5.4-mini',
      image: process.env.AI_MODEL_IMAGE?.trim() || 'gpt-image-2',
    },
  },
  database: {
    url: process.env.DATABASE_URL?.trim() || 'file:.data/agents.sqlite',
  },
  tavily: {
    apiKeys: (process.env.TAVILY_API_KEY || 'tvly-xxx')
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0),
  },
  pubmed: {
    tool: process.env.PUBMED_TOOL?.trim() || 'agents',
    email: process.env.PUBMED_EMAIL?.trim() || 'pubmed@example.com',
    apiKey: process.env.PUBMED_API_KEY?.trim() || 'xxx',
  },
  webshare: {
    apiKey: process.env.WEBSHARE_API_KEY?.trim() || 'xxx',
    proxies: [] as string[],
  },
  oss: {
    baseUrl: process.env.OSS_BASE_URL?.trim() || 'https://oss.example.cc',
    accessKey: process.env.OSS_ACCESS_KEY?.trim() || 'xxx',
    secretKey: process.env.OSS_SECRET_KEY?.trim() || 'xxx',
    bucket: process.env.OSS_BUCKET?.trim() || 'agents',
    region: process.env.OSS_REGION?.trim() || 'auto',
  },
  exec: {
    workspacePath:
      process.env.EXEC_WORKSPACE_PATH?.trim() || '.data/workspace',
  },
};
