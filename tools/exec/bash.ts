import {
  commandInputSchema,
  commandOutputSchema,
  executeBashCommand,
  type CommandInput,
} from "@/tools/exec/shared"
import { tool } from "ai"

export const bashTool = tool({
  description: "执行 bash 命令。",
  inputSchema: commandInputSchema,
  outputSchema: commandOutputSchema,
  execute: async (input: CommandInput, { abortSignal }) => {
    return await executeBashCommand(input, abortSignal)
  },
})
