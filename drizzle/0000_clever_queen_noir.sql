CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`messages` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
