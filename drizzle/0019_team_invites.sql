-- 0019: Team invite modul — team_invites tábla
-- A migrate-db.mjs idempotens (CREATE TABLE hibáit lenyeli).

CREATE TABLE IF NOT EXISTS `team_invites` (
  `id` varchar(64) NOT NULL PRIMARY KEY,
  `profileId` varchar(64) NOT NULL,
  `email` varchar(320) NOT NULL,
  `role` enum('owner','editor','viewer') NOT NULL DEFAULT 'editor',
  `token` varchar(64) NOT NULL UNIQUE,
  `status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
  `invitedByUserId` varchar(64),
  `invitedByName` varchar(255),
  `expiresAt` timestamp NOT NULL,
  `acceptedAt` timestamp NULL,
  `acceptedByUserId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_team_invites_profileId` (`profileId`),
  KEY `idx_team_invites_email` (`email`)
);
