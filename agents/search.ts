import { asTool as createAgentTool } from "@/utils/as-tool"
import { openaiProvider, options } from "@/lib/ai"
import { InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai"
import { z } from "zod"

const instructions = `
你是一个专门负责搜索信息的助手。
你的职责：
1. 优先使用 webSearch 搜索和核验信息，尤其是最新、动态、需要事实依据的问题。
2. 综合多个结果后再回答，不要只复述单条搜索结果。
3. 最终回复保持简洁直接，并附上关键来源链接。
4. 如果搜索结果不足以支持结论，要明确说明不确定性。
`.trim()

export const SearchAgent = new ToolLoopAgent({
  ...options,
  id: "Search Agent",
  instructions,
  stopWhen: [stepCountIs(8)],
  tools: {
    webSearch: openaiProvider.tools.webSearch({
      externalWebAccess: true,
      searchContextSize: "high",
    }),
  },
})

const searchToolInputSchema = z.object({
  query: z.string().describe("需要搜索的完整问题，包含必要上下文"),
})

export const searchTool = createAgentTool(SearchAgent, {
  description: "搜索并核验互联网信息，适用于资料查询、事实核验和最新信息问题。",
  inputSchema: searchToolInputSchema,
  toPrompt: ({ query }) => query,
})

export type SearchAgentUIMessage = InferAgentUIMessage<typeof SearchAgent>
