import {
  codeInputSchema,
  commandOutputSchema,
  executeJavaScript,
  type CodeInput,
} from "@/tools/exec/shared"
import { tool } from "ai"

export const javascriptTool = tool({
  description: "使用 node 执行 JavaScript 代码。",
  inputSchema: codeInputSchema,
  outputSchema: commandOutputSchema,
  execute: async (input: CodeInput, { abortSignal }) => {
    return await executeJavaScript(input, abortSignal)
  },
})
