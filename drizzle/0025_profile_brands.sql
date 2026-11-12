-- 0025: G1 – alárkák (márkák) a profilon belül, márkánkénti riporthoz.
-- (a) profile_brands: egy profilnak 0..n márkája; a név profilon belül egyedi,
--     a social_hub_external_ref (opcionális Social Hub-párosítókulcs) globálisan
--     egyedi (NULL-ból több is lehet).
-- (b) data_connections / report_metrics / reports: nullable brandId.
--     NULL = márka nélküli (kapcsolat, metrika) ill. összesített (riport), így a
--     meglévő sorok változatlanul a mostani viselkedést adják.
-- (c) index a report_metrics (profileId, brandId) oszlopaira a márkaszűréshez.
-- Csak bővít (nincs DROP/MODIFY). A migrate-db.mjs minden deploynál újrafuttatja:
-- a CREATE TABLE IF NOT EXISTS idempotens, a „Duplicate column name” és
-- „Duplicate key name” hibát lenyeli.
CREATE TABLE IF NOT EXISTS `profile_brands` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`social_hub_external_ref` varchar(64) NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profile_brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `profile_brands_social_hub_external_ref_unique` UNIQUE(`social_hub_external_ref`),
	CONSTRAINT `profile_brands_profile_name_unique` UNIQUE(`profileId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `profile_brands` ADD INDEX `profile_brands_profileId_idx` (`profileId`);
--> statement-breakpoint
ALTER TABLE `data_connections` ADD COLUMN `brandId` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `report_metrics` ADD COLUMN `brandId` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `brandId` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `report_metrics` ADD INDEX `report_metrics_profileId_brandId_idx` (`profileId`,`brandId`);
