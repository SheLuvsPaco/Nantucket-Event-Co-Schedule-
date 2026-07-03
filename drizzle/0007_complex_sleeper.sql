ALTER TABLE `events` ADD `business` text DEFAULT 'TENTS' NOT NULL;--> statement-breakpoint
CREATE INDEX `events_business_idx` ON `events` (`business`);--> statement-breakpoint
ALTER TABLE `inventory_items` ADD `business` text DEFAULT 'TENTS' NOT NULL;--> statement-breakpoint
CREATE INDEX `inventory_business_idx` ON `inventory_items` (`business`);--> statement-breakpoint
ALTER TABLE `users` ADD `business` text DEFAULT 'TENTS' NOT NULL;--> statement-breakpoint
CREATE INDEX `users_business_idx` ON `users` (`business`);--> statement-breakpoint
ALTER TABLE `vehicles` ADD `business` text DEFAULT 'TENTS' NOT NULL;--> statement-breakpoint
CREATE INDEX `vehicles_business_idx` ON `vehicles` (`business`);