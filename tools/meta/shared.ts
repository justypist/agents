import {
  createAgentRecord,
  createToolRecord,
  deleteRegistryRecord,
  getRegistryRecord,
  listRegistryRecords,
  type RegistryAgentContextMode,
  type RegistryAgentRecord,
  type RegistryEntityType,
  type RegistryToolRecord,
} from "@/lib/registry-runtime"
import { z } from "zod"

const entityTypeSchema = z
  .enum(["agent", "tool"])
  .describe("定义类型。'tool' 表示工具定义，'agent' 表示子 agent 定义。")
const definitionIdSchema = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "id 只能包含字母、数字、下划线和短横线"
  )
  .describe("定义 id。只能包含字母、数字、下划线和短横线。不要使用点号、空格或其他符号。")
const agentContextModeSchema = z
  .enum(["shared", "isolated"])
  .describe("子 agent 的上下文模式。'shared' 继承上文，'isolated' 只接收当前任务。")
const jsonSchemaTextSchema = z.union([
  z.string().describe("JSON Schema 字符串"),
  z.record(z.string(), z.unknown()).describe("JSON Schema 对象"),
  z.boolean().describe("JSON Schema 布尔值"),
])

const toolDefinitionSchema = z.object({
  id: definitionIdSchema,
  description: z.string().min(1).describe("tool 的用途说明，给模型决定是否复用。"),
  inputSchema: jsonSchemaTextSchema.describe("tool 输入参数的 JSON Schema。"),
  outputSchema: jsonSchemaTextSchema.describe("tool 输出结果的 JSON Schema。"),
  source: z
    .string()
    .min(1)
    .describe(
      "可执行 JavaScript 函数表达式，形如 '(input, context) => result' 或 'async (input, context) => result'。"
    ),
})

const agentDefinitionSchema = z.object({
  id: definitionIdSchema,
  description: z.string().min(1).describe("agent 的职责说明，给模型决定是否复用。"),
  instructions: z.string().min(1).describe("agent 的系统指令。"),
  contextMode: agentContextModeSchema.default("isolated"),
  toolIds: z
    .array(z.string().min(1))
    .default([])
    .describe("该 agent 可调用的 tool id 列表。"),
  agentIds: z
    .array(z.string().min(1))
    .default([])
    .describe("该 agent 可调用的子 agent id 列表。"),
})

const toolRecordSchema = z.object({
  entityType: z.literal("tool"),
  id: z.string(),
  description: z.string(),
  inputSchema: z.string(),
  outputSchema: z.string(),
  source: z.string(),
})

const agentRecordSchema = z.object({
  entityType: z.literal("agent"),
  id: z.string(),
  description: z.string(),
  instructions: z.string(),
  contextMode: agentContextModeSchema,
  toolIds: z.array(z.string()),
  agentIds: z.array(z.string()),
})

const toolSummarySchema = toolRecordSchema.omit({
  inputSchema: true,
  outputSchema: true,
  source: true,
})

const agentSummarySchema = agentRecordSchema.omit({
  instructions: true,
  contextMode: true,
  toolIds: true,
  agentIds: true,
})

const definitionRecordSchema = z.union([toolRecordSchema, agentRecordSchema])
const definitionSummarySchema = z.union([toolSummarySchema, agentSummarySchema])

const createRegistryEntryArgsSchema = z.discriminatedUnion("entityType", [
  z.object({
    entityType: z.literal("tool"),
    value: toolDefinitionSchema,
  }),
  z.object({
    entityType: z.literal("agent"),
    value: agentDefinitionSchema,
  }),
])

export const createRegistryEntryInputSchema = z.object({
  entityType: entityTypeSchema.describe("要创建的定义类型。"),
  value: z
    .union([toolDefinitionSchema, agentDefinitionSchema])
    .describe("完整定义内容。字段必须与所选 entityType 对应。"),
})

export const createRegistryEntryOutputSchema = z.object({
  action: z.literal("create"),
  record: definitionRecordSchema,
})

export const readRegistryEntryInputSchema = z.object({
  entityType: entityTypeSchema.describe("要查询的定义类型。"),
  id: z
    .string()
    .min(1)
    .optional()
    .describe("精确 id 查询。只有在你明确知道 id 时才传；列出列表时不要传此字段。"),
  query: z
    .string()
    .min(1)
    .optional()
    .describe("列表查询关键字。用于按 id/name/description 模糊搜索。"),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("列表查询返回条数上限，默认 50。"),
})

export const readRegistryEntryOutputSchema = z.union([
  z.object({
    action: z.literal("read"),
    mode: z.literal("get"),
    count: z.literal(1),
    record: definitionRecordSchema,
  }),
  z.object({
    action: z.literal("read"),
    mode: z.literal("list"),
    entityType: entityTypeSchema,
    count: z.number().int().nonnegative(),
    records: z.array(definitionSummarySchema),
  }),
])

export const deleteRegistryEntryInputSchema = z.object({
  entityType: entityTypeSchema.describe("要删除的定义类型。"),
  id: definitionIdSchema.describe("要删除的定义 id。"),
})

export const deleteRegistryEntryOutputSchema = z.object({
  action: z.literal("delete"),
  entityType: entityTypeSchema,
  id: z.string(),
  deleted: z.literal(true),
})

export type CreateRegistryEntryInput = z.infer<typeof createRegistryEntryArgsSchema>
const listSentinelIds = new Set([
  "*",
  "/",
  ".",
  "all",
  "list",
  "ls",
  "cat",
  "tool",
  "tools",
  "agent",
  "agents",
])

function normalizeLookupText(value: string | undefined) {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : undefined
}

function resolveListQuery(id: string | undefined, query: string | undefined) {
  const normalizedId = normalizeLookupText(id)
  const normalizedQuery = normalizeLookupText(query)

  if (normalizedQuery) {
    return normalizedQuery
  }

  if (!normalizedId) {
    return undefined
  }

  if (listSentinelIds.has(normalizedId.toLowerCase())) {
    return undefined
  }

  return normalizedId
}

export function parseCreateRegistryEntryInput(input: unknown) {
  return createRegistryEntryArgsSchema.parse(input)
}

function normalizeJsonSchemaText(value: z.infer<typeof jsonSchemaTextSchema>) {
  if (typeof value === "string") {
    const parsedValue: unknown = JSON.parse(value)

    if (
      typeof parsedValue !== "boolean" &&
      (typeof parsedValue !== "object" || parsedValue === null)
    ) {
      throw new Error("schema 必须是合法 JSON Schema")
    }

    return JSON.stringify(parsedValue)
  }

  return JSON.stringify(value)
}

function serializeToolRecord(record: RegistryToolRecord) {
  return {
    entityType: "tool" as const,
    id: record.id,
    description: record.description,
    inputSchema: record.inputSchema,
    outputSchema: record.outputSchema,
    source: record.source,
  }
}

function serializeAgentRecord(record: RegistryAgentRecord) {
  return {
    entityType: "agent" as const,
    id: record.id,
    description: record.description,
    instructions: record.instructions,
    contextMode: record.contextMode,
    toolIds: record.toolIds,
    agentIds: record.agentIds,
  }
}

function serializeToolSummary(record: RegistryToolRecord) {
  return {
    entityType: "tool" as const,
    id: record.id,
    description: record.description,
  }
}

function serializeAgentSummary(record: RegistryAgentRecord) {
  return {
    entityType: "agent" as const,
    id: record.id,
    description: record.description,
  }
}

export async function createRegistryEntry(
  input: CreateRegistryEntryInput
) {
  if (input.entityType === "tool") {
    const record = await createToolRecord({
      id: input.value.id,
      description: input.value.description,
      inputSchema: normalizeJsonSchemaText(input.value.inputSchema),
      outputSchema: normalizeJsonSchemaText(input.value.outputSchema),
      source: input.value.source,
    })

    return {
      action: "create" as const,
      record: serializeToolRecord(record),
    }
  }

  const record = await createAgentRecord({
    id: input.value.id,
    description: input.value.description,
    instructions: input.value.instructions,
    contextMode: input.value.contextMode as RegistryAgentContextMode,
    toolIds: input.value.toolIds,
    agentIds: input.value.agentIds,
  })

  return {
    action: "create" as const,
    record: serializeAgentRecord(record),
  }
}

export async function readRegistryEntry(
  input: z.infer<typeof readRegistryEntryInputSchema>
) {
  const normalizedId = normalizeLookupText(input.id)
  const normalizedQuery = normalizeLookupText(input.query)
  const shouldTreatAsListRequest =
    !normalizedId ||
    listSentinelIds.has(normalizedId.toLowerCase()) ||
    normalizedQuery === normalizedId

  if (!shouldTreatAsListRequest && normalizedId) {
    try {
      const record = getRegistryRecord(
        input.entityType as RegistryEntityType,
        normalizedId
      )

      return {
        action: "read" as const,
        mode: "get" as const,
        count: 1 as const,
        record:
          input.entityType === "tool"
            ? serializeToolRecord(record as RegistryToolRecord)
            : serializeAgentRecord(record as RegistryAgentRecord),
      }
    } catch {
      // 当模型误把列表查询词放进 id 时，自动降级为列表查询，避免无意义报错。
    }
  }

  const records = listRegistryRecords(input.entityType as RegistryEntityType, {
    query: resolveListQuery(normalizedId, normalizedQuery),
    limit: input.limit,
  })

  return {
    action: "read" as const,
    mode: "list" as const,
    entityType: input.entityType,
    count: records.length,
    records: records.map((record) =>
      record.entityType === "tool"
        ? serializeToolSummary(record)
        : serializeAgentSummary(record)
    ),
  }
}

export async function deleteRegistryEntry(
  input: z.infer<typeof deleteRegistryEntryInputSchema>
) {
  return await deleteRegistryRecord(
    input.entityType as RegistryEntityType,
    input.id
  )
}
