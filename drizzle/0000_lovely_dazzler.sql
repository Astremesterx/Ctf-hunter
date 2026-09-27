CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_key` text NOT NULL,
	`payload` text NOT NULL,
	`start` text NOT NULL,
	`published` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_canonical_key_unique` ON `events` (`canonical_key`);--> statement-breakpoint
CREATE INDEX `idx_events_published_start` ON `events` (`published`,`start`);--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` text NOT NULL,
	`organizer` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `organizer`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message` text NOT NULL,
	`event_id` text,
	`created_at` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_created` ON `runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `saved` (
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`approved` integer DEFAULT 0 NOT NULL,
	`permission_note` text,
	`adapter` text DEFAULT 'jsonld' NOT NULL,
	`last_attempt` text,
	`last_success` text,
	`hash` text,
	`status` text DEFAULT 'Awaiting approval' NOT NULL,
	`failure` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_url_unique` ON `sources` (`url`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_status_created` ON `submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_submissions_user_created` ON `submissions` (`user_id`,`created_at`);