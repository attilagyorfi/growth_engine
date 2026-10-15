-- Kikapcsolt social kapcsolatok hozzáférési kulcsainak törlése (2026-10-15).
-- A Meta-engedélyezés után ~36 ügyfél-oldal / Instagram kulcsa maradt inaktív sorokban.
-- Idempotens: a migrate-db.mjs minden deploynál lefuttatja, a már üres sorokat nem érinti.
-- Az aktív kapcsolatokhoz NEM nyúl.
UPDATE `social_connections` SET `accessToken` = '', `refreshToken` = NULL WHERE `isActive` = false AND (`accessToken` <> '' OR `refreshToken` IS NOT NULL);
