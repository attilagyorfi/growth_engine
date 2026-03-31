CREATE TABLE `app_notifications` (
	`id` varchar(64) NOT NULL,
	`appUserId` varchar(64) NOT NULL,
	`profileId` varchar(64),
	`type` enum('approval_ready','new_lead','reply_received','campaign_deadline','strategy_update','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`actionUrl` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_assets` (
	`id` varchar(64) NOT NULL,
	`campaignId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`type` enum('copy','image','video','email','ad','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`fileUrl` text,
	`platform` varchar(64),
	`status` enum('draft','review','approved','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaign_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`strategyVersionId` varchar(64),
	`title` varchar(255) NOT NULL,
	`objective` text,
	`targetAudience` text,
	`channels` json,
	`budget` varchar(64),
	`startDate` varchar(20),
	`endDate` varchar(20),
	`status` enum('draft','active','paused','completed','archived') NOT NULL DEFAULT 'draft',
	`brief` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`type` enum('strategy','content','campaign','lead','analytics') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`urgency` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`actionUrl` varchar(512),
	`isRead` boolean NOT NULL DEFAULT false,
	`isDismissed` boolean NOT NULL DEFAULT false,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_versions` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`versionNumber` int NOT NULL DEFAULT 1,
	`title` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`quarterlyGoals` json,
	`monthlyPriorities` json,
	`weeklySprints` json,
	`executiveSummary` text,
	`channelStrategy` json,
	`campaignPriorities` json,
	`quickWins` json,
	`nextActions` json,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `appUserId` varchar(64);