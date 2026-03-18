CREATE TABLE `client_profiles` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`initials` varchar(4) NOT NULL,
	`color` varchar(100) NOT NULL DEFAULT 'oklch(0.6 0.2 255)',
	`website` varchar(500) DEFAULT '',
	`industry` varchar(255) DEFAULT '',
	`description` text DEFAULT (''),
	`logoUrl` varchar(500),
	`primaryColor` varchar(20) DEFAULT '#3B82F6',
	`secondaryColor` varchar(20) DEFAULT '#10B981',
	`fontHeading` varchar(100) DEFAULT 'Sora',
	`fontBody` varchar(100) DEFAULT 'Inter',
	`brandGuidelineUrl` varchar(500),
	`brandVoice` json DEFAULT ('{"tone":"","style":"","avoid":"","keywords":[]}'),
	`contentPillars` json DEFAULT ('[]'),
	`socialAccounts` json DEFAULT ('[]'),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_posts` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`platform` enum('linkedin','facebook','instagram','twitter','tiktok') NOT NULL,
	`content` text NOT NULL,
	`imageUrl` varchar(1000),
	`imagePrompt` text,
	`hashtags` json DEFAULT ('[]'),
	`status` enum('draft','approved','scheduled','published','rejected') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`pillar` varchar(255),
	`weekNumber` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`provider` enum('gmail','outlook') NOT NULL,
	`email` varchar(320) NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiry` timestamp,
	`connected` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_integrations_profileId_unique` UNIQUE(`profileId`)
);
--> statement-breakpoint
CREATE TABLE `inbound_emails` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`from` varchar(320) NOT NULL,
	`fromName` varchar(255),
	`company` varchar(255),
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`category` enum('interested','not_interested','question','meeting_request','out_of_office','unsubscribe','other') NOT NULL DEFAULT 'other',
	`read` boolean NOT NULL DEFAULT false,
	`relatedOutboundId` varchar(64),
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbound_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`company` varchar(255) NOT NULL,
	`contact` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`position` varchar(255),
	`industry` varchar(255),
	`website` varchar(500),
	`source` varchar(100) DEFAULT 'manual',
	`status` enum('new','researched','email_draft','approved','sent','replied','meeting','closed_won','closed_lost') NOT NULL DEFAULT 'new',
	`score` int DEFAULT 0,
	`notes` text,
	`tags` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outbound_emails` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`leadId` varchar(64),
	`to` varchar(320) NOT NULL,
	`toName` varchar(255),
	`company` varchar(255),
	`subject` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`status` enum('draft','approved','sent','opened','replied','bounced') NOT NULL DEFAULT 'draft',
	`sentAt` timestamp,
	`openedAt` timestamp,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outbound_emails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`month` varchar(20) NOT NULL,
	`status` enum('active','draft','archived') NOT NULL DEFAULT 'draft',
	`summary` text,
	`goals` json DEFAULT ('[]'),
	`weeklyPlans` json DEFAULT ('[]'),
	`kpis` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategies_id` PRIMARY KEY(`id`)
);
