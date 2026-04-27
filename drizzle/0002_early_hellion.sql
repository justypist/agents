ALTER TABLE "chat_sessions" ADD COLUMN "turn_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "current_user_message_id" text;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "turn_error_summary" text;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "turn_updated_at" timestamp with time zone;