-- 0015: imapUid mező az inbound_emails táblára
-- Cél: az IMAP fetcher duplikáció-szűrése (egy emailt csak egyszer szúrjunk be,
-- akkor is, ha újra fetcheljük az INBOX UNSEEN-jeit egy másik szinkronkor).
-- A migrate-db.mjs idempotens — ha az oszlop már létezik, a "Duplicate column"
-- hibát lenyeli.
ALTER TABLE `inbound_emails` ADD COLUMN `imapUid` varchar(64);
--> statement-breakpoint
CREATE INDEX `idx_inbound_emails_imapUid` ON `inbound_emails` (`imapUid`);
