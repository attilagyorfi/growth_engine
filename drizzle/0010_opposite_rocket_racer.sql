ALTER TABLE `content_posts` MODIFY COLUMN `status` enum('draft','review','approved','scheduled','published','rejected') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `content_posts` ADD `reviewedBy` varchar(64);--> statement-breakpoint
ALTER TABLE `content_posts` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_posts` ADD `rejectionReason` text;