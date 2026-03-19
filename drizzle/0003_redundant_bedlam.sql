CREATE TABLE `ai_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`memoryType` enum('approved_pattern','rejected_pattern','style_preference','cta_preference','content_preference','client_correction') NOT NULL,
	`context` varchar(255),
	`content` text NOT NULL,
	`platform` varchar(100),
	`pillar` varchar(255),
	`weight` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`contentPostId` varchar(64),
	`platform` varchar(100),
	`metric` varchar(255) NOT NULL,
	`value` int NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64),
	`userId` varchar(64),
	`userName` varchar(255),
	`action` varchar(255) NOT NULL,
	`objectType` varchar(100) NOT NULL,
	`objectId` varchar(64),
	`objectTitle` varchar(500),
	`changes` json,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_intelligence` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`companySummary` text,
	`brandDna` json,
	`offerMap` json,
	`audienceMap` json,
	`competitorSnapshot` json,
	`platformPriorities` json,
	`successGoals` json,
	`complianceConstraints` json,
	`aiWritingRules` json,
	`visualRules` json,
	`websiteAnalysis` json,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_intelligence_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_intelligence_profileId_unique` UNIQUE(`profileId`)
);
--> statement-breakpoint
CREATE TABLE `competitor_profiles` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`website` varchar(500),
	`positioning` text,
	`strengths` json,
	`weaknesses` json,
	`contentStrategy` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `competitor_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_calendar_items` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`contentPostId` varchar(64),
	`strategyTaskId` varchar(64),
	`title` varchar(500) NOT NULL,
	`platform` varchar(100) NOT NULL,
	`format` varchar(100),
	`funnelStage` varchar(50),
	`pillar` varchar(255),
	`campaignTag` varchar(255),
	`scheduledAt` timestamp NOT NULL,
	`status` enum('planned','draft','approved','scheduled','published','cancelled') NOT NULL DEFAULT 'planned',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_calendar_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`contentPostId` varchar(64) NOT NULL,
	`action` enum('approved','rejected','edited','requested_changes') NOT NULL,
	`reason` text,
	`editedFields` json,
	`reviewerId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`step` int NOT NULL,
	`fieldKey` varchar(255) NOT NULL,
	`fieldValue` text,
	`aiGenerated` boolean NOT NULL DEFAULT false,
	`userConfirmed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `onboarding_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onboarding_sessions` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`status` enum('in_progress','completed','abandoned') NOT NULL DEFAULT 'in_progress',
	`currentStep` int NOT NULL DEFAULT 1,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onboarding_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publishing_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`contentPostId` varchar(64) NOT NULL,
	`platform` varchar(100) NOT NULL,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`platformPostId` varchar(255),
	`platformPostUrl` varchar(1000),
	`errorMessage` text,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publishing_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`platform` enum('linkedin','facebook','instagram','twitter','tiktok') NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiry` timestamp,
	`platformUserId` varchar(255),
	`platformUsername` varchar(255),
	`pageId` varchar(255),
	`connected` boolean NOT NULL DEFAULT false,
	`scopes` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_tasks` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`platform` varchar(100),
	`format` varchar(100),
	`funnelStage` enum('awareness','consideration','decision','retention') NOT NULL DEFAULT 'awareness',
	`weekNumber` int,
	`dueDate` timestamp,
	`status` enum('todo','in_progress','done','skipped') NOT NULL DEFAULT 'todo',
	`assignedTo` varchar(255),
	`contentPostId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `target_personas` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`role` varchar(255),
	`age` varchar(50),
	`industry` varchar(255),
	`painPoints` json,
	`goals` json,
	`preferredChannels` json,
	`buyingTriggers` json,
	`objections` json,
	`messagingApproach` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `target_personas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploaded_brand_assets` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileType` varchar(100) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`assetType` enum('brand_guide','visual_identity','sales_material','strategy','buyer_persona','faq','other') NOT NULL DEFAULT 'other',
	`parsedContent` text,
	`parsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uploaded_brand_assets_id` PRIMARY KEY(`id`)
);
