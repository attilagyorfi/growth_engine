CREATE TABLE `content_ideas` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`pillar` varchar(120),
	`platform` varchar(40),
	`source` enum('ai','user') NOT NULL DEFAULT 'user',
	`status` enum('new','used','archived') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_ideas_id` PRIMARY KEY(`id`)
);
