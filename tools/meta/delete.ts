import {
  deleteRegistryEntry,
  deleteRegistryEntryInputSchema,
  deleteRegistryEntryOutputSchema,
} from "@/tools/meta/shared"
import { tool } from "ai"

export const deleteRegistryEntryTool = tool({
  description:
    "删除一个 agent 或 tool 定义记录。参数格式固定为 { entityType, id }。",
  inputSchema: deleteRegistryEntryInputSchema,
  outputSchema: deleteRegistryEntryOutputSchema,
  execute: async (input) => {
    return await deleteRegistryEntry(input)
  },
})
