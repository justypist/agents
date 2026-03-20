import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const toolTypeEnum = pgEnum('tool_type', ['internal', 'agent'])

export const toolsTable = pgTable(
  'tools',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: toolTypeEnum('type').notNull(),
    description: text('description').notNull(),
    inputSchema: text('input_schema').notNull(),
    outputSchema: text('output_schema').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('tools_name_idx').on(table.name),
    index('tools_type_idx').on(table.type),
  ]
)

export const agentsTable = pgTable(
  'agents',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    instructions: text('instructions').notNull(),
    toolIds: text('tool_ids').array().notNull(),
    agentIds: text('agent_ids').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('agents_name_idx').on(table.name),
  ]
)

export type Tool = typeof toolsTable.$inferSelect
export type NewTool = typeof toolsTable.$inferInsert
export type ToolType = Tool['type']
export type Agent = typeof agentsTable.$inferSelect
export type NewAgent = typeof agentsTable.$inferInsert
