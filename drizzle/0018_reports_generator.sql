-- 0018: Riportgenerátor modul — 4 új tábla
-- A migrate-db.mjs idempotens (CREATE TABLE hibáit lenyeli); biztonságosan
-- újrafuttatható. A schema Drizzle-oldala: drizzle/schema.ts (2026-06).

CREATE TABLE IF NOT EXISTS `data_connections` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `profileId` varchar(64) NOT NULL,
  `platform` enum('google_ads','ga4','search_console','meta_ads') NOT NULL,
  `externalAccountId` varchar(255) NOT NULL,
  `externalAccountName` varchar(255),
  `accessToken` text,
  `refreshToken` text,
  `tokenExpiry` timestamp NULL,
  `scopes` json,
  `connected` boolean NOT NULL DEFAULT false,
  `lastSyncedAt` timestamp NULL,
  `lastSyncError` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_data_connections_profileId` (`profileId`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `report_metrics` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `profileId` varchar(64) NOT NULL,
  `platform` enum('google_ads','ga4','search_console','meta_ads') NOT NULL,
  `date` date NOT NULL,
  `metricKey` varchar(64) NOT NULL,
  `value` double NOT NULL,
  `currency` varchar(3),
  `dimension` json,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_report_metrics_profile_date` (`profileId`, `date`),
  KEY `idx_report_metrics_key` (`metricKey`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `reports` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `profileId` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `periodFrom` date NOT NULL,
  `periodTo` date NOT NULL,
  `templateKey` varchar(64) NOT NULL DEFAULT 'default',
  `status` enum('pending','rendering','rendered','delivered','failed') NOT NULL DEFAULT 'pending',
  `summaryData` json,
  `aiSummary` text,
  `pdfUrl` varchar(1000),
  `createdBy` varchar(64),
  `deliveredAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_reports_profileId` (`profileId`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `report_schedules` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `profileId` varchar(64) NOT NULL UNIQUE,
  `templateKey` varchar(64) NOT NULL DEFAULT 'default',
  `dayOfMonth` int NOT NULL DEFAULT 3,
  `recipients` json,
  `active` boolean NOT NULL DEFAULT true,
  `lastRunAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
