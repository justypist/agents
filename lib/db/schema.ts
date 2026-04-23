import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  title: text('title'),
  messages: text('messages').notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type NewChatSessionRow = typeof chatSessions.$inferInsert;
