import {
  codeInputSchema,
  commandOutputSchema,
  executePython,
  type CodeInput,
} from "@/tools/exec/shared"
import { tool } from "ai"

export const pythonTool = tool({
  description: "使用 python3 执行 Python 代码。",
  inputSchema: codeInputSchema,
  outputSchema: commandOutputSchema,
  execute: async (input: CodeInput, { abortSignal }) => {
    return await executePython(input, abortSignal)
  },
})
