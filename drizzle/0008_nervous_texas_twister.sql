CREATE TABLE `scheduled_posts` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`contentId` varchar(64),
	`platform` enum('facebook','instagram','linkedin','twitter') NOT NULL,
	`text` text NOT NULL,
	`imageUrl` text,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','published','failed') NOT NULL DEFAULT 'pending',
	`publishedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduled_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_connections` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`platform` enum('facebook','instagram','linkedin','twitter') NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`tokenExpiresAt` varchar(32),
	`platformUserId` varchar(255),
	`platformUsername` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_connections_id` PRIMARY KEY(`id`)
);
