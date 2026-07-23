PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`inventory_item_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`packed` integer DEFAULT false NOT NULL,
	`notes` text,
	`section` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_event_inventory`("id", "event_id", "inventory_item_id", "quantity", "packed", "notes", "section", "sort_order")
SELECT 'evi_' || lower(hex(randomblob(16))), "event_id", "inventory_item_id", "quantity", "packed", "notes", NULL, 0
FROM `event_inventory`;--> statement-breakpoint
DROP TABLE `event_inventory`;--> statement-breakpoint
ALTER TABLE `__new_event_inventory` RENAME TO `event_inventory`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `event_inventory_event_idx` ON `event_inventory` (`event_id`);
