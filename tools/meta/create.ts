import {
  createRegistryEntry,
  createRegistryEntryInputSchema,
  createRegistryEntryOutputSchema,
  parseCreateRegistryEntryInput,
} from "@/tools/meta/shared"
import { tool } from "ai"

export const createRegistryEntryTool = tool({
  description:
    "创建一个 agent 或 tool 定义记录。tool 只需要 id、description、inputSchema、outputSchema、source。agent 只需要 id、description、instructions、contextMode、toolIds、agentIds。",
  inputSchema: createRegistryEntryInputSchema,
  outputSchema: createRegistryEntryOutputSchema,
  execute: async (input) => {
    return await createRegistryEntry(parseCreateRegistryEntryInput(input))
  },
})
