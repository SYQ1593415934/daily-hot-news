CREATE TABLE `daily_reports` (
	`date` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`rank` integer NOT NULL,
	`observed_at` text NOT NULL,
	`published_at` text,
	`story_id` text,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_status` (
	`platform` text PRIMARY KEY NOT NULL,
	`last_attempt_at` text,
	`last_success_at` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`category` text,
	`updated_at` text NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL
);
