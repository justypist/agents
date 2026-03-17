import { type Agent, type ModelMessage, tool, type ToolSet } from "ai"
import type { ZodType } from "zod"
import { z } from "zod"

type AgentToolOptions<INPUT> = {
  description: string
  inputSchema: ZodType<INPUT>
  toPrompt: (input: INPUT) => string | Array<ModelMessage>
}

export function asTool<INPUT, TOOLS extends ToolSet>(
  agent: Agent<never, TOOLS>,
  options: AgentToolOptions<INPUT>
) {
  return tool({
    description: options.description,
    inputSchema: options.inputSchema,
    outputSchema: z.string(),
    execute: async (input, { abortSignal }) => {
      const result = await agent.generate({
        prompt: options.toPrompt(input),
        abortSignal,
      })

      return result.text
    },
    toModelOutput: ({ output }) => ({
      type: "text" as const,
      value: output,
    }),
  })
}
