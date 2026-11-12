-- 0024: G1 – közösségi metrikák a Social Hubból (integrációs szerződés v1).
-- (a) client_profiles.external_ref: nullable, egyedi párosítókulcs a Social Hub
--     `client` rekordjához. NULL-ból több is lehet (párosítatlan profilok).
-- (b) report_metrics.platform ENUM bővítése facebook/instagram/linkedin értékkel;
--     a meglévő értékek és sorrendjük változatlan, így adat nem vész el.
-- A migrate-db.mjs minden deploynál újrafuttatja: a „Duplicate column name” és
-- „Duplicate key name” hibát lenyeli, a MODIFY COLUMN pedig eleve idempotens.
ALTER TABLE `client_profiles` ADD COLUMN `external_ref` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `client_profiles` ADD CONSTRAINT `client_profiles_external_ref_unique` UNIQUE(`external_ref`);
--> statement-breakpoint
ALTER TABLE `report_metrics` MODIFY COLUMN `platform` ENUM('google_ads','ga4','search_console','meta_ads','facebook','instagram','linkedin') NOT NULL;
