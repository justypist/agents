CREATE TYPE "public"."agent_context_mode" AS ENUM('shared', 'isolated');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"context_mode" "agent_context_mode" NOT NULL,
	"tool_ids" text[] NOT NULL,
	"agent_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"input_schema" text NOT NULL,
	"output_schema" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agents_description_idx" ON "agents" USING btree ("description");--> statement-breakpoint
CREATE INDEX "agents_context_mode_idx" ON "agents" USING btree ("context_mode");--> statement-breakpoint
CREATE INDEX "tools_description_idx" ON "tools" USING btree ("description");