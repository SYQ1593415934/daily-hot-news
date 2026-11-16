CREATE TABLE `hotlist_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`observation_id` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`rank` integer NOT NULL,
	`observed_at` text NOT NULL,
	`source_updated_at` text
);
