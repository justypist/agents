import { loadEnvConfig } from '@next/env'
 
const projectDir = process.cwd()
loadEnvConfig(projectDir)

type AIMethod = "responses" | "chat-completions";

export const config = {
  ai: {
    baseUrl: process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1",
    apiKey: process.env.AI_API_KEY?.trim() || "sk-xxx",
    method: (process.env.AI_API_METHOD?.trim().toLowerCase() || 'responses') as AIMethod,
    model: process.env.AI_MODEL?.trim() || "gpt-5.4",
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY?.trim() || "tvly-xxx",
  },
  pubmed: {
    tool: process.env.PUBMED_TOOL?.trim() || "agents",
    email: process.env.PUBMED_EMAIL?.trim() || "pubmed@example.com",
    apiKey: process.env.PUBMED_API_KEY?.trim() || "xxx",
  },
  webshare: {
    apiKey: process.env.WEBSHARE_API_KEY?.trim() || "xxx",
    proxies: [] as string[],
  },
};
