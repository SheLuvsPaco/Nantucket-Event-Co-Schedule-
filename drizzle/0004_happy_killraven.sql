CREATE TABLE `management_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`event_date` text NOT NULL,
	`event_time` text,
	`image_storage_key` text NOT NULL,
	`image_content_type` text NOT NULL,
	`image_original_name` text NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `management_invoices_date_idx` ON `management_invoices` (`event_date`);--> statement-breakpoint
CREATE INDEX `management_invoices_created_at_idx` ON `management_invoices` (`created_at`);