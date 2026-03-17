import { searchTool } from "@/agents/search"
import { options } from "@/lib/ai"
import { InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai"

const instructions = `
你是一个通用助手，语言言简意赅。
遇到以下情况，优先调用 search 工具而不是直接作答：
1. 用户明确要求搜索、查资料、联网或核验。
2. 问题涉及最新、当前、实时、近期变化的信息。
3. 你不确定答案是否准确，或者需要来源支持。
`.trim()

export const MainAgent = new ToolLoopAgent({
  ...options,
  id: "Main Agent",
  instructions,
  stopWhen: [stepCountIs(16)],
  tools: {
    search: searchTool,
  },
})

export type MainAgentUIMessage = InferAgentUIMessage<typeof MainAgent>
