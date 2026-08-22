-- 0020: AI Copilot (asszisztens) — assistant_threads + assistant_messages
-- A migrate-db.mjs idempotens (CREATE TABLE hibáit lenyeli); biztonságosan
-- újrafuttatható. A schema Drizzle-oldala: drizzle/schema.ts.

CREATE TABLE IF NOT EXISTS `assistant_threads` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `appUserId` varchar(64) NOT NULL,
  `profileId` varchar(64),
  `title` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_assistant_threads_user` (`appUserId`),
  KEY `idx_assistant_threads_profile` (`profileId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assistant_messages` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `threadId` varchar(64) NOT NULL,
  `role` enum('user','assistant') NOT NULL,
  `content` text NOT NULL,
  `page` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_assistant_messages_thread` (`threadId`)
);
