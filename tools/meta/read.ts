import {
  readRegistryEntry,
  readRegistryEntryInputSchema,
  readRegistryEntryOutputSchema,
} from "@/tools/meta/shared"
import { tool } from "ai"

export const readRegistryEntryTool = tool({
  description:
    "查看单个 agent/tool 定义，或者列出当前所有定义记录。按 id 查询时传 { entityType, id }。列出列表时不要传 id，可传 { entityType } 或 { entityType, query, limit }。",
  inputSchema: readRegistryEntryInputSchema,
  outputSchema: readRegistryEntryOutputSchema,
  execute: async (input) => {
    return await readRegistryEntry(input)
  },
})
