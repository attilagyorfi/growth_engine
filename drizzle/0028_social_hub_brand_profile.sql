-- 0028: G2 – márkaprofil-szinkron a Social Hubba.
-- social_hub_brand_profiles: profilonként egy sor a kötelező és tiltott kifejezésekkel, a
-- kötelező záradékkal és a szinkron állapotával (változásszám, bérlet, legutóbbi cél, hiba).
-- Az idők ezredmásodpercek (bigint), mert a sima timestamp másodpercre kerekít.
-- Csak új táblát hoz létre, meglévőt nem érint. A migrate-db.mjs minden indulásnál
-- újrafuttatja, ezért idempotens.
CREATE TABLE IF NOT EXISTS `social_hub_brand_profiles` (
	`profileId` varchar(64) NOT NULL,
	`requiredPhrases` json NOT NULL,
	`forbiddenPhrases` json NOT NULL,
	`requiredDisclaimer` text NULL,
	`requestedRev` bigint NOT NULL,
	`syncedRev` bigint NOT NULL,
	`leaseToken` varchar(64) NULL,
	`leaseUntilMs` bigint NULL,
	`targetRef` varchar(64) NULL,
	`targetUrlHash` varchar(64) NULL,
	`targetClientId` varchar(64) NULL,
	`maybeSent` boolean NOT NULL,
	`sentHash` varchar(64) NULL,
	`sentAtMs` bigint NULL,
	`lastErrorCode` varchar(32) NULL,
	`lastErrorAtMs` bigint NULL,
	`lastErrorTarget` varchar(64) NULL,
	CONSTRAINT `social_hub_brand_profiles_profileId` PRIMARY KEY(`profileId`)
);
