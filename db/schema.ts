import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const agentContextModeEnum = pgEnum('agent_context_mode', [
  'shared',
  'isolated',
])

export const toolsTable = pgTable(
  'tools',
  {
    id: text('id').primaryKey(),
    description: text('description').notNull(),
    inputSchema: text('input_schema').notNull(),
    outputSchema: text('output_schema').notNull(),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('tools_description_idx').on(table.description),
  ]
)

export const agentsTable = pgTable(
  'agents',
  {
    id: text('id').primaryKey(),
    description: text('description').notNull(),
    instructions: text('instructions').notNull(),
    contextMode: agentContextModeEnum('context_mode').notNull(),
    toolIds: text('tool_ids').array().notNull(),
    agentIds: text('agent_ids').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('agents_description_idx').on(table.description),
    index('agents_context_mode_idx').on(table.contextMode),
  ]
)

export type Tool = typeof toolsTable.$inferSelect
export type NewTool = typeof toolsTable.$inferInsert
export type Agent = typeof agentsTable.$inferSelect
export type NewAgent = typeof agentsTable.$inferInsert
export type AgentContextMode = Agent['contextMode']
