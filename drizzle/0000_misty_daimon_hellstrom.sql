CREATE TABLE `event_inventory` (
	`event_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`notes` text,
	PRIMARY KEY(`event_id`, `inventory_item_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `event_inventory_event_idx` ON `event_inventory` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_staff` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assignment` text,
	`call_time` text,
	`notes` text,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `event_staff_event_idx` ON `event_staff` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_timeline` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`time` text NOT NULL,
	`label` text NOT NULL,
	`details` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `timeline_event_idx` ON `event_timeline` (`event_id`);--> statement-breakpoint
CREATE TABLE `event_vehicles` (
	`event_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`driver_user_id` text,
	`destination` text,
	`departure_time` text,
	`notes` text,
	PRIMARY KEY(`event_id`, `vehicle_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`driver_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `event_vehicles_event_idx` ON `event_vehicles` (`event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`event_date` text NOT NULL,
	`venue` text,
	`address` text,
	`client_name` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`call_time` text,
	`departure_time` text,
	`return_time` text,
	`notes` text,
	`staff_brief` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `events` (`event_date`);--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`size` text,
	`image_url` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_category_idx` ON `inventory_items` (`category`);--> statement-breakpoint
CREATE INDEX `inventory_active_idx` ON `inventory_items` (`active`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'Truck' NOT NULL,
	`capacity` text,
	`plate` text,
	`color` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vehicles_active_idx` ON `vehicles` (`active`);