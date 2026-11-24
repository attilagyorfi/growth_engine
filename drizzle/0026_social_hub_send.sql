-- 0026: G2 – Social Hub-kapcsolat és a vázlatküldés naplója.
-- (a) social_hub_connection: egyetlen sor, a kulcs csak titkosítva (enc:v1:).
-- (b) social_hub_send_attempts: küldési kísérlet. Az idempotencyKey egyedi, a body a pontos
--     kimenő törzs. A firstTriedAt ismétléskor sem változik (erre épül az ismétlési ablak).
-- (c) social_hub_post_deliveries: poszt + Social Hub-ügyfél szerint egyedi napló.
-- Az időket a kód adja, ezért egyik oszlop sem frissül magától.
-- Csak új táblát hoz létre, meglévőt nem érint. A migrate-db.mjs minden indulásnál
-- újrafuttatja, ezért idempotens.
CREATE TABLE IF NOT EXISTS `social_hub_connection` (
	`id` varchar(64) NOT NULL,
	`baseUrl` varchar(500) NOT NULL,
	`apiKeyEnc` text NOT NULL,
	`apiKeyLast4` varchar(4) NOT NULL,
	`updatedBy` varchar(64) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_hub_connection_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `social_hub_send_attempts` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`socialHubClientId` varchar(64) NOT NULL,
	`baseUrlHash` varchar(64) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`body` mediumtext NOT NULL,
	`postIds` json NOT NULL,
	`status` varchar(20) NOT NULL,
	`runToken` varchar(64) NOT NULL,
	`firstTriedAt` timestamp NOT NULL DEFAULT (now()),
	`lastTriedAt` timestamp NOT NULL DEFAULT (now()),
	`lastError` varchar(255) NULL,
	`createdBy` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_hub_send_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_hub_send_attempts_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `social_hub_post_deliveries` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`postId` varchar(64) NOT NULL,
	`socialHubClientId` varchar(64) NOT NULL,
	`status` varchar(20) NOT NULL,
	`attemptId` varchar(64) NULL,
	`contentHash` varchar(64) NULL,
	`sentHash` varchar(64) NULL,
	`socialHubPostId` varchar(64) NULL,
	`sentAt` timestamp NULL,
	CONSTRAINT `social_hub_post_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `social_hub_post_deliveries_post_client_unique` UNIQUE(`postId`,`socialHubClientId`)
);
