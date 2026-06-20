ALTER TABLE `event_inventory` ADD `packed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `packer_user_id` text REFERENCES users(id);