import { loadEnvConfig } from '@next/env'
 
const projectDir = process.cwd()
loadEnvConfig(projectDir)

export const config = {
  env: process.env.NODE_ENV || "development",
  ai: {
    baseURL: process.env.AI_BASE_URL!,
    apiKey: process.env.AI_API_KEY!,
    model: {
      language: process.env.AI_LANGUAGE_MODEL!,
    },
  },
}
