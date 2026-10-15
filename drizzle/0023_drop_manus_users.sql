-- 0023: a Manus OAuth-bridge `users` táblájának törlése (G0 takarítás, 2026-10-15).
-- A bejelentkezés kizárólag az `app_users` táblán (email + jelszó) fut; a Manus
-- OAuth-bridge kódja ugyanebben a változásban törlődött.
-- A táblát létrehozó 0000_clever_blizzard.sql is törölve, így a migrate-db.mjs
-- (amely minden deploynál minden fájlt újrafuttat) nem hozza létre újra.
-- Idempotens: ha a tábla már nincs meg, nem történik semmi.
DROP TABLE IF EXISTS `users`;
