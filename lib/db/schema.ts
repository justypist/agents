import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  title: text('title'),
  messages: text('messages').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const skills = pgTable(
  'skills',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description').notNull(),
    content: text('content').notNull(),
    status: text('status').notNull().default('disabled'),
    sourceSessionId: text('source_session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [uniqueIndex('skills_name_unique').on(table.name)],
);

export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type NewChatSessionRow = typeof chatSessions.$inferInsert;
export type SkillRow = typeof skills.$inferSelect;
export type NewSkillRow = typeof skills.$inferInsert;
