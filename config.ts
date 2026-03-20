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
  oss: {
    endpoint: process.env.OSS_ENDPOINT!,
    region: process.env.OSS_REGION!,
    bucket: process.env.OSS_BUCKET!,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.OSS_SECRET_ACCESS_KEY!,
    publicBaseUrl: (process.env.OSS_PUBLIC_BASE_URL || "").replace(/\/+$/, "")!,
    forcePathStyle: process.env.OSS_FORCE_PATH_STYLE === "true",
    keyPrefix: (process.env.OSS_KEY_PREFIX || "").replace(/^\/+|\/+$/g, ""),
  },
};
