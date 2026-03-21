import {
  invokeRegistryEntry,
  streamRuntimeAgentInvocation,
} from "@/lib/registry-runtime"
import { tool } from "ai"
import { z } from "zod"

const definitionIdSchema = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "id 只能包含字母、数字、下划线和短横线"
  )

const invokeRegistryEntryArgsSchema = z.discriminatedUnion("entityType", [
  z.object({
    entityType: z.literal("tool"),
    id: definitionIdSchema,
    input: z.unknown().optional(),
  }),
  z.object({
    entityType: z.literal("agent"),
    id: definitionIdSchema,
    task: z.string().min(1),
  }),
])

export const invokeRegistryEntryInputSchema = z.object({
  entityType: z
    .enum(["tool", "agent"])
    .describe("调用目标的类型。调用 tool 传 'tool'，调用 agent 传 'agent'。"),
  id: definitionIdSchema.describe("要调用的目标定义 id。"),
  input: z
    .unknown()
    .optional()
    .describe("调用 tool 时传入的输入对象。仅在 entityType='tool' 时使用。"),
  task: z
    .string()
    .optional()
    .describe("调用 agent 时传入的任务文本。仅在 entityType='agent' 时使用。"),
})

export const invokeRegistryEntryOutputSchema = z.discriminatedUnion("entityType", [
  z.object({
    entityType: z.literal("tool"),
    id: z.string(),
    output: z.unknown(),
  }),
  z.object({
    entityType: z.literal("agent"),
    id: z.string(),
    outputText: z.string(),
  }),
])

export const invokeRegistryEntryTool = tool({
  description:
    "按 id 调用一个当前内存中已存在的 tool 或 agent 定义。调用 tool 时传 { entityType: 'tool', id, input }；调用 agent 时传 { entityType: 'agent', id, task }。调用 agent 时会自动按其 contextMode 决定共享还是隔离上下文。",
  inputSchema: invokeRegistryEntryInputSchema,
  outputSchema: invokeRegistryEntryOutputSchema,
  execute: async function* (input, executionOptions) {
    const parsedInput = invokeRegistryEntryArgsSchema.parse(input)

    if (parsedInput.entityType === "tool") {
      yield await invokeRegistryEntry({
        ...parsedInput,
        abortSignal: executionOptions.abortSignal,
        messages: executionOptions.messages,
      })
      return
    }

    let didYield = false

    for await (const outputText of streamRuntimeAgentInvocation({
      agentId: parsedInput.id,
      task: parsedInput.task,
      abortSignal: executionOptions.abortSignal,
      messages: executionOptions.messages,
    })) {
      didYield = true
      yield {
        entityType: "agent" as const,
        id: parsedInput.id,
        outputText,
      }
    }

    if (!didYield) {
      yield {
        entityType: "agent" as const,
        id: parsedInput.id,
        outputText: "",
      }
    }
  },
})
