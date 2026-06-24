-- 0016: értékesítés-modul (inbound_emails + outbound_emails) törlése.
-- Kontextus: a felhasználó 2026-06-ban úgy döntött, hogy a teljes
-- értékesítés-modult kivesszük — mindenki a saját email-szolgáltatóját
-- használja. Ez megszünteti a security audit #1 (spam-relay) sebezhetőséget,
-- a UI Sales Ops oldalát, az IMAP fetcher-t és a kapcsolódó tRPC routereket.
--
-- A `leads` táblát MEGTARTJUK — a hírlevél-feliratkozók (newsletterConsent=true
-- regisztrációk) is itt élnek, és a Hírlevél modul lekérdezi.
--
-- A migrate-db.mjs idempotens — ha a tábla már nem létezik, hibát lenyeli.
DROP TABLE IF EXISTS `inbound_emails`;
--> statement-breakpoint
DROP TABLE IF EXISTS `outbound_emails`;
