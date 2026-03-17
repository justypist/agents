import { openaiProvider } from "@/lib/ai"

export const webSearchTool = openaiProvider.tools.webSearch({
  externalWebAccess: true,
  searchContextSize: "high",
})
