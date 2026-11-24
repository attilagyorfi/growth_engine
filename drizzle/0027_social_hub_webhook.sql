-- 0027: G2 – Social Hub webhook-fogadó.
-- (a) social_hub_webhook_secret: egyetlen sor, a titok csak titkosítva (enc:v1:).
-- (b) social_hub_webhook_events: a feldolgozott események; az eseményazonosító egyedi.
-- (c) social_hub_post_states: a Social Hub-poszt állapota, socialHubPostId szerint. Az események
--     ideje ezredmásodperc (bigint), mert a sima timestamp másodpercre kerekít.
-- (d) social_hub_memory_marks: posztonként és döntésenként egy AI-memória.
-- Csak új táblát hoz létre, meglévőt nem érint. A migrate-db.mjs minden indulásnál
-- újrafuttatja, ezért idempotens.
CREATE TABLE IF NOT EXISTS `social_hub_webhook_secret` (
	`id` varchar(64) NOT NULL,
	`secretEnc` text NOT NULL,
	`updatedBy` varchar(64) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_hub_webhook_secret_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `social_hub_webhook_events` (
	`eventId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`socialHubPostId` varchar(64) NOT NULL,
	`type` varchar(32) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_hub_webhook_events_eventId` PRIMARY KEY(`eventId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `social_hub_post_states` (
	`socialHubPostId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`postId` varchar(64) NOT NULL,
	`socialHubClientId` varchar(64) NOT NULL,
	`latestStatus` varchar(32) NULL,
	`latestAtMs` bigint NULL,
	`failedAtMs` bigint NULL,
	`publishedAtMs` bigint NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_hub_post_states_socialHubPostId` PRIMARY KEY(`socialHubPostId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `social_hub_memory_marks` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`postId` varchar(64) NOT NULL,
	`decision` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_hub_memory_marks_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_hub_memory_marks_post_decision_unique` UNIQUE(`postId`,`decision`)
);
