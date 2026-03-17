import { asTool as createAgentTool } from "@/utils/as-tool"
import { options } from "@/lib/ai"
import { bashTool } from "@/tools/exec/bash"
import { javascriptTool } from "@/tools/exec/javascript"
import { pythonTool } from "@/tools/exec/python"
import { InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai"
import { z } from "zod"

const instructions = `
你是一个专门负责执行命令的助手。
你的职责：
1. 你当前直接运行在用户本地机器的当前项目目录，不是在容器里，也不是只读沙箱演示环境。
2. 你可以实际调用 bash、node 和 python3 执行命令；不要误报“无权限”“容器受限”或“无法真实执行”，除非工具结果明确显示失败。
3. 根据任务选择 bash、javascript 或 python 工具执行。
4. 执行前先明确最小可行命令，避免无关操作。
5. 最终回复简洁总结执行了什么、输出重点、退出码或超时情况。
6. 当需要多步执行时，按顺序执行，并基于上一步结果决定下一步。
`.trim()

export const ExecAgent = new ToolLoopAgent({
  ...options,
  id: "Exec Agent",
  instructions,
  stopWhen: [stepCountIs(8)],
  tools: {
    bash: bashTool,
    javascript: javascriptTool,
    python: pythonTool,
  },
})

const execToolInputSchema = z.object({
  task: z.string().describe("需要执行的命令任务，包含目标、约束和期望输出"),
})

export const execTool = createAgentTool(ExecAgent, {
  description:
    "执行本地命令，适用于 bash、JavaScript(node) 和 Python(python3) 脚本运行、命令验证和环境检查。",
  inputSchema: execToolInputSchema,
  toPrompt: ({ task }) => task,
})

export type ExecAgentUIMessage = InferAgentUIMessage<typeof ExecAgent>
