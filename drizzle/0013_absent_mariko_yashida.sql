CREATE TABLE `heygenVideos` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`profileId` varchar(64),
	`heygenVideoId` varchar(255),
	`title` varchar(255) NOT NULL,
	`script` text NOT NULL,
	`avatarId` varchar(255),
	`voiceId` varchar(255),
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`videoUrl` varchar(1000),
	`thumbnailUrl` varchar(1000),
	`durationSeconds` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `heygenVideos_id` PRIMARY KEY(`id`)
);
