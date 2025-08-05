CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`podcast_id` text NOT NULL,
	`title` text NOT NULL,
	`publish_date` text NOT NULL,
	`transcript` text NOT NULL,
	`summary` text,
	`key_insights` text,
	`main_topics` text,
	`actionable_items` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `episodes_podcast_id_idx` ON `episodes` (`podcast_id`);--> statement-breakpoint
CREATE INDEX `episodes_publish_date_idx` ON `episodes` (`publish_date`);--> statement-breakpoint
CREATE TABLE `podcasts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`taddy_id` text NOT NULL,
	`latest_episode_title` text,
	`latest_episode_date` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `podcasts_taddy_id_idx` ON `podcasts` (`taddy_id`);--> statement-breakpoint
CREATE TABLE `summary_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`selected_podcasts` text NOT NULL,
	`episode_limit` integer NOT NULL,
	`send_email` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `summary_requests_user_email_idx` ON `summary_requests` (`user_email`);--> statement-breakpoint
CREATE INDEX `summary_requests_status_idx` ON `summary_requests` (`status`);--> statement-breakpoint
CREATE INDEX `summary_requests_created_at_idx` ON `summary_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `trend_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`summary_request_id` text NOT NULL,
	`recurring_themes` text NOT NULL,
	`emerging_topics` text NOT NULL,
	`contradictions` text NOT NULL,
	`meta_insights` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`summary_request_id`) REFERENCES `summary_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trend_analyses_summary_request_id_idx` ON `trend_analyses` (`summary_request_id`);