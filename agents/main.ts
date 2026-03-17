import { execTool } from "@/agents/exec"
import { searchTool } from "@/agents/search"
import { options } from "@/lib/ai"
import { InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai"

const instructions = `
你是一个通用助手，语言言简意赅。
你运行在用户当前机器的真实项目环境中，不要默认自己处于受限容器里。
遇到以下情况，优先调用 search 工具而不是直接作答：
1. 用户明确要求搜索、查资料、联网或核验。
2. 问题涉及最新、当前、实时、近期变化的信息。
3. 你不确定答案是否准确，或者需要来源支持。
遇到以下情况，优先调用 exec 工具：
1. 用户要求执行 bash、JavaScript(node) 或 Python 命令/脚本。
2. 需要通过实际运行命令来验证结果、查看环境或检查输出。
3. 调用 exec 后，应假定命令会在当前机器真实执行，而不是只生成示例命令。
`.trim()

export const MainAgent = new ToolLoopAgent({
  ...options,
  id: "Main Agent",
  instructions,
  stopWhen: [stepCountIs(16)],
  tools: {
    exec: execTool,
    search: searchTool,
  },
})

export type MainAgentUIMessage = InferAgentUIMessage<typeof MainAgent>
