import {
  executeBashCommand,
  type CommandInput,
} from "@/tools/exec/shared"
import { asTool } from "@/utils/as-tool"
import { db } from "@/db"
import { agentsTable, toolsTable, type Agent, type Tool } from "@/db/schema"
import {
  jsonSchema,
  stepCountIs,
  tool,
  ToolLoopAgent,
  type ModelMessage,
  type ToolSet,
} from "ai"
import { desc, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"

import { options } from "./ai"

export type RegistryEntityType = "agent" | "tool"
export type RegistryAgentContextMode = "shared" | "isolated"

export type RegistryToolRecord = {
  entityType: "tool"
  id: string
  description: string
  inputSchema: string
  outputSchema: string
  source: string
}

export type RegistryAgentRecord = {
  entityType: "agent"
  id: string
  description: string
  instructions: string
  contextMode: RegistryAgentContextMode
  toolIds: string[]
  agentIds: string[]
}

type JsonSchemaValue = boolean | Record<string, unknown>
type RuntimeTool = ToolSet[string]
type RuntimeToolMap = Record<string, RuntimeTool>
type RuntimeAgent = ToolLoopAgent<never, RuntimeToolMap>

type RuntimeExecutionOptions = {
  abortSignal?: AbortSignal
  messages?: ModelMessage[]
}

type RuntimeHelpers = {
  executeBashCommand: (
    input: CommandInput | string,
    abortSignal?: AbortSignal
  ) => ReturnType<typeof executeBashCommand>
  invokeTool: (
    toolId: string,
    input: unknown,
    options?: RuntimeExecutionOptions
  ) => Promise<unknown>
  invokeAgent: (
    agentId: string,
    task: string,
    options?: RuntimeExecutionOptions
  ) => Promise<string>
}

type ToolSourceContext = {
  input: unknown
  abortSignal?: AbortSignal
  messages: ModelMessage[]
  helpers: RuntimeHelpers
}

const builtInRuntimeToolIds = new Set([
  "createRegistryEntry",
  "readRegistryEntry",
  "deleteRegistryEntry",
  "invokeRegistryEntry",
])

const runtimeAgentCapabilityInstructions = `
你也是一个动态 agent/tool 编排器。
除当前定义里显式挂载的 tool 和子 agent 外，你始终还可以使用 createRegistryEntry、readRegistryEntry、deleteRegistryEntry、invokeRegistryEntry 这四个 meta tools 来复用、创建、删除、调用定义。

工作约束：
1. 所有业务定义都持久化在 PostgreSQL 中；查询当前可用定义时，以数据库查询结果为准。
2. 先检查是否已有可复用定义，再决定是否创建新定义。
3. 没有合适定义时，只创建完成当前任务所需的最小定义。
4. 如果当前任务适合拆成可复用流程、需要多步编排、或需要长期复用，优先创建 agent。
5. 你创建出的新 agent 同样具备这套动态定义能力。
`.trim()

function normalizeSource(source: string) {
  const trimmed = source.trim()

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
      .replace(/\n```$/, "")
      .trim()
  }

  return trimmed.replace(/^export\s+default\s+/, "").trim()
}

function compileSource<T>(source: string, label: string) {
  const normalizedSource = normalizeSource(source)

  if (!normalizedSource) {
    throw new Error(`${label} source 不能为空`)
  }

  try {
    return new Function(`"use strict"; return (${normalizedSource});`)() as T
  } catch (expressionError) {
    try {
      return new Function(
        `"use strict";
        const module = { exports: undefined };
        const exports = {};
        ${normalizedSource}
        return module.exports ?? exports.default;`
      )() as T
    } catch (moduleError) {
      throw new AggregateError(
        [expressionError, moduleError],
        `${label} source 编译失败`
      )
    }
  }
}

function parseJsonSchema(schema: string, label: string) {
  const parsed: unknown = JSON.parse(schema)

  if (
    typeof parsed !== "boolean" &&
    (typeof parsed !== "object" || parsed === null)
  ) {
    throw new Error(`${label} 不是合法 JSON Schema`)
  }

  return parsed as JsonSchemaValue
}

function normalizeJsonSchemaValue(schema: JsonSchemaValue) {
  if (typeof schema === "boolean") {
    return schema ? {} : { not: {} }
  }

  return schema
}

function formatModelMessageContent(content: ModelMessage["content"]) {
  if (typeof content === "string") {
    return content
  }

  return content
    .map((part) => {
      if ("text" in part && typeof part.text === "string") {
        return part.text
      }

      return JSON.stringify(part)
    })
    .join("\n")
}

function buildSharedPrompt(messages: ModelMessage[], task: string) {
  const contextText = messages
    .map((message) => `${message.role}:\n${formatModelMessageContent(message.content)}`)
    .join("\n\n")

  if (!contextText) {
    return task
  }

  return [
    "以下是调用方上下文：",
    contextText,
    "",
    "当前需要完成的任务：",
    task,
  ].join("\n")
}

async function getRuntimeRegistryTools(): Promise<RuntimeToolMap> {
  const [
    { createRegistryEntryTool },
    { readRegistryEntryTool },
    { deleteRegistryEntryTool },
    { invokeRegistryEntryTool },
  ] = await Promise.all([
    import("@/tools/meta/create"),
    import("@/tools/meta/read"),
    import("@/tools/meta/delete"),
    import("@/tools/meta/invoke"),
  ])

  return {
    createRegistryEntry: createRegistryEntryTool,
    readRegistryEntry: readRegistryEntryTool,
    deleteRegistryEntry: deleteRegistryEntryTool,
    invokeRegistryEntry: invokeRegistryEntryTool,
  }
}

async function* streamRuntimeAgentText(
  runtimeAgent: RuntimeAgent,
  prompt: string | ModelMessage[],
  abortSignal?: AbortSignal
) {
  const result = await runtimeAgent.stream({
    prompt,
    abortSignal,
  })

  let text = ""
  let didYield = false

  for await (const delta of result.textStream) {
    text += delta
    didYield = true
    yield text
  }

  if (!didYield) {
    yield text
  }
}

function createRuntimeHelpers(): RuntimeHelpers {
  const normalizeCommandInput = (input: CommandInput | string): CommandInput =>
    typeof input === "string" ? { command: input } : input

  return {
    executeBashCommand: (input, abortSignal) =>
      executeBashCommand(normalizeCommandInput(input), abortSignal),
    invokeTool: invokeRuntimeTool,
    invokeAgent: invokeRuntimeAgent,
  }
}

function mapToolRowToRecord(row: Tool): RegistryToolRecord {
  return {
    entityType: "tool",
    id: row.id,
    description: row.description,
    inputSchema: row.inputSchema,
    outputSchema: row.outputSchema,
    source: row.source,
  }
}

function mapAgentRowToRecord(row: Agent): RegistryAgentRecord {
  return {
    entityType: "agent",
    id: row.id,
    description: row.description,
    instructions: row.instructions,
    contextMode: row.contextMode,
    toolIds: row.toolIds,
    agentIds: row.agentIds,
  }
}

async function getToolRecordById(id: string) {
  const [record] = await db
    .select()
    .from(toolsTable)
    .where(eq(toolsTable.id, id))
    .limit(1)

  if (!record) {
    throw new Error(`未找到 tool: ${id}`)
  }

  return mapToolRowToRecord(record)
}

async function getAgentRecordById(id: string) {
  const [record] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.id, id))
    .limit(1)

  if (!record) {
    throw new Error(`未找到 agent: ${id}`)
  }

  return mapAgentRowToRecord(record)
}

function createRuntimeTool(record: RegistryToolRecord) {
  const executable = compileSource<
    (input: unknown, context: ToolSourceContext) => Promise<unknown> | unknown
  >(record.source, `tool ${record.id}`)

  return tool({
    description: record.description,
    inputSchema: jsonSchema(
      normalizeJsonSchemaValue(
        parseJsonSchema(record.inputSchema, `${record.id}.inputSchema`)
      )
    ),
    outputSchema: jsonSchema(
      normalizeJsonSchemaValue(
        parseJsonSchema(record.outputSchema, `${record.id}.outputSchema`)
      )
    ),
    execute: async (input, executionOptions) => {
      return await executable(input, {
        input,
        abortSignal: executionOptions.abortSignal,
        messages: executionOptions.messages ?? [],
        helpers: createRuntimeHelpers(),
      })
    },
  })
}

export function validateRegistryToolDefinition(
  record: Omit<RegistryToolRecord, "entityType">
) {
  createRuntimeTool({
    entityType: "tool",
    ...record,
  })
}

export async function getRuntimeTool(toolId: string): Promise<RuntimeTool> {
  return createRuntimeTool(await getToolRecordById(toolId))
}

export async function getRuntimeAgent(agentId: string): Promise<RuntimeAgent> {
  const runtimeRegistryTools = await getRuntimeRegistryTools()
  const record = await getAgentRecordById(agentId)
  const toolEntries = await Promise.all(
    record.toolIds.map(async (toolId) => [toolId, await getRuntimeTool(toolId)] as const)
  )
  const childAgentEntries = await Promise.all(
    record.agentIds.map(async (childAgentId) => {
      const childRecord = await getAgentRecordById(childAgentId)
      const childAgent = await getRuntimeAgent(childAgentId)

      return [
        childAgentId,
        asTool(childAgent, {
          description: childRecord.description,
          inputSchema: z.object({
            task: z.string().describe("需要委托给子 agent 的完整任务"),
          }),
          toPrompt: ({ task }) => task,
        }),
      ] as const
    })
  )

  const tools = {
    ...runtimeRegistryTools,
    ...Object.fromEntries([...toolEntries, ...childAgentEntries]),
  } satisfies RuntimeToolMap
  const runtimeAgent = new ToolLoopAgent({
    ...options,
    id: record.id,
    instructions: `${runtimeAgentCapabilityInstructions}\n\n${record.instructions}`,
    stopWhen: [stepCountIs(record.contextMode === "shared" ? 24 : 16)],
    tools,
  })

  return runtimeAgent
}

async function invokeRuntimeTool(
  toolId: string,
  input: unknown,
  executionOptions: RuntimeExecutionOptions = {}
) {
  const runtimeTool = await getRuntimeTool(toolId)

  if (typeof runtimeTool.execute !== "function") {
    throw new Error(`tool ${toolId} 没有 execute 实现`)
  }

  return await runtimeTool.execute(input, {
    toolCallId: `registry-tool-${toolId}`,
    abortSignal: executionOptions.abortSignal,
    messages: executionOptions.messages ?? [],
  })
}

async function invokeRuntimeAgent(
  agentId: string,
  task: string,
  executionOptions: RuntimeExecutionOptions = {}
) {
  const record = await getAgentRecordById(agentId)
  const runtimeAgent = await getRuntimeAgent(agentId)
  const prompt =
    record.contextMode === "shared"
      ? buildSharedPrompt(executionOptions.messages ?? [], task)
      : task
  let finalText = ""

  for await (const text of streamRuntimeAgentText(
    runtimeAgent,
    prompt,
    executionOptions.abortSignal
  )) {
    finalText = text
  }

  return finalText
}

export async function* streamRuntimeAgentInvocation(options: {
  agentId: string
  task: string
  abortSignal?: AbortSignal
  messages?: ModelMessage[]
}) {
  const record = await getAgentRecordById(options.agentId)
  const runtimeAgent = await getRuntimeAgent(options.agentId)
  const prompt =
    record.contextMode === "shared"
      ? buildSharedPrompt(options.messages ?? [], options.task)
      : options.task

  for await (const text of streamRuntimeAgentText(
    runtimeAgent,
    prompt,
    options.abortSignal
  )) {
    yield text
  }
}

export async function invokeRegistryEntry(options: {
  entityType: RegistryEntityType
  id: string
  input?: unknown
  task?: string
  abortSignal?: AbortSignal
  messages?: ModelMessage[]
}) {
  if (options.entityType === "tool") {
    return {
      entityType: "tool" as const,
      id: options.id,
      output: await invokeRuntimeTool(options.id, options.input, {
        abortSignal: options.abortSignal,
        messages: options.messages,
      }),
    }
  }

  return {
    entityType: "agent" as const,
    id: options.id,
    outputText: await invokeRuntimeAgent(options.id, options.task ?? "", {
      abortSignal: options.abortSignal,
      messages: options.messages,
    }),
  }
}

export async function clearRuntimeRegistryCaches() {
  return {
    cleared: true as const,
  }
}

async function assertRegistryIdAvailable(id: string) {
  const [toolRecord, agentRecord] = await Promise.all([
    db.select({ id: toolsTable.id }).from(toolsTable).where(eq(toolsTable.id, id)).limit(1),
    db.select({ id: agentsTable.id }).from(agentsTable).where(eq(agentsTable.id, id)).limit(1),
  ])

  if (toolRecord[0] || agentRecord[0]) {
    throw new Error(`id 已存在: ${id}`)
  }
}

export async function createToolRecord(
  value: Omit<RegistryToolRecord, "entityType">
) {
  if (builtInRuntimeToolIds.has(value.id)) {
    throw new Error(`id 为系统保留名称: ${value.id}`)
  }

  await assertRegistryIdAvailable(value.id)

  validateRegistryToolDefinition(value)

  const [record] = await db
    .insert(toolsTable)
    .values({
      id: value.id,
      description: value.description,
      inputSchema: value.inputSchema,
      outputSchema: value.outputSchema,
      source: value.source,
    })
    .returning()

  return mapToolRowToRecord(record)
}

export async function createAgentRecord(
  value: Omit<RegistryAgentRecord, "entityType">
) {
  if (builtInRuntimeToolIds.has(value.id)) {
    throw new Error(`id 为系统保留名称: ${value.id}`)
  }

  await assertRegistryIdAvailable(value.id)

  const [record] = await db
    .insert(agentsTable)
    .values({
      id: value.id,
      description: value.description,
      instructions: value.instructions,
      contextMode: value.contextMode,
      toolIds: value.toolIds,
      agentIds: value.agentIds,
    })
    .returning()

  return mapAgentRowToRecord(record)
}

export async function deleteRegistryRecord(entityType: RegistryEntityType, id: string) {
  const deletedRecords =
    entityType === "tool"
      ? await db.delete(toolsTable).where(eq(toolsTable.id, id)).returning({ id: toolsTable.id })
      : await db
          .delete(agentsTable)
          .where(eq(agentsTable.id, id))
          .returning({ id: agentsTable.id })

  if (deletedRecords.length === 0) {
    throw new Error(`未找到 ${entityType}: ${id}`)
  }

  return {
    action: "delete" as const,
    entityType,
    id,
    deleted: true as const,
  }
}

export async function getRegistryRecord(entityType: RegistryEntityType, id: string) {
  return entityType === "tool" ? await getToolRecordById(id) : await getAgentRecordById(id)
}

export async function listRegistryRecords(
  entityType: RegistryEntityType,
  options: { query?: string; limit?: number } = {}
) {
  const limit = options.limit ?? 50
  const query = options.query ? `%${options.query}%` : undefined

  if (entityType === "tool") {
    const records = await db
      .select()
      .from(toolsTable)
      .where(
        query
          ? or(
              ilike(toolsTable.id, query),
              ilike(toolsTable.description, query)
            )
          : undefined
      )
      .orderBy(desc(toolsTable.createdAt))
      .limit(limit)

    return records.map(mapToolRowToRecord)
  }

  const records = await db
    .select()
    .from(agentsTable)
    .where(
      query
        ? or(
            ilike(agentsTable.id, query),
            ilike(agentsTable.description, query)
          )
        : undefined
    )
    .orderBy(desc(agentsTable.createdAt))
    .limit(limit)

  return records.map(mapAgentRowToRecord)
}
