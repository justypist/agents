import { openaiProvider, options } from "@/lib/ai"
import { InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai"

const instructions = "你是一个通用助手，语言言简意赅。"

export const MainAgent = new ToolLoopAgent({
  ...options,
  id: "Main Agent",
  instructions,
  stopWhen: [stepCountIs(16)],
  tools: {
    webSearch: openaiProvider.tools.webSearch({
      externalWebAccess: true,
      searchContextSize: 'high',
    }),
  },
})

export type MainAgentUIMessage = InferAgentUIMessage<typeof MainAgent>
