-- 0017: social_connections.platform enum bővítés `tiktok`-kal
-- A migrate-db.mjs idempotens — ha az enum már tartalmazza, hibát lenyel.
ALTER TABLE `social_connections` MODIFY COLUMN `platform` ENUM('facebook','instagram','linkedin','twitter','tiktok') NOT NULL;
