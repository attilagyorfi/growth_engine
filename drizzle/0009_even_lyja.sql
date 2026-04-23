CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`ownerId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`website` varchar(500),
	`industry` varchar(255),
	`description` text,
	`logoUrl` varchar(500),
	`color` varchar(100) DEFAULT 'oklch(0.6 0.2 255)',
	`profileId` varchar(64),
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_profile_cache` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`platform` varchar(50) NOT NULL,
	`url` varchar(500) NOT NULL,
	`analysis` json,
	`scrapedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_profile_cache_id` PRIMARY KEY(`id`)
);
