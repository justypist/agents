CREATE TYPE "public"."tool_type" AS ENUM('internal', 'agent');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"instructions" text NOT NULL,
	"tool_ids" text[] NOT NULL,
	"agent_ids" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "tool_type" NOT NULL,
	"description" text NOT NULL,
	"input_schema" text NOT NULL,
	"output_schema" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agents_name_idx" ON "agents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tools_name_idx" ON "tools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tools_type_idx" ON "tools" USING btree ("type");