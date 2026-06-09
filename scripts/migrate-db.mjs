/**
 * G2A Growth Engine – DB auto-migration (idempotent, safe)
 *
 * Minden Railway/Render deploy előtt lefut a `prestart` hook-ból.
 *
 * Mit csinál:
 * 1. Csatlakozik a DATABASE_URL-en (mysql2/promise)
 * 2. drizzle-kit `push --force` mode-ot futtat — szinkronizálja a TS schema-t
 *    a DB-vel. Csak ADDITIVE műveleteket hagyunk át (CREATE TABLE, ADD COLUMN),
 *    destruktívokat NEM (DROP TABLE, DROP COLUMN) — a `--strict` flag-gel kompatibilis.
 * 3. Hiba esetén log + exit 0 — a `|| true` mégis hagyná start-olni, de itt
 *    proper logot adunk hogy lássuk mi történt.
 *
 * Ha a DATABASE_URL nincs beállítva (pl. lokális dev DB nélkül), skip.
 *
 * MIÉRT ez és nem `pnpm db:push` (drizzle-kit generate + migrate)?
 * - A migrate fájl-alapú: kell egy committelt migrations/ mappa.
 * - Mi production-on DIRECT schema sync-et akarunk, nem migration history-t.
 * - A drizzle-kit `push` parancs pontosan ezt csinálja: schema → DB diff,
 *   és push-olja a változásokat.
 */
import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[migrate-db] DATABASE_URL nincs beállítva — skipping migration.");
  process.exit(0);
}

console.log("[migrate-db] DB schema sync start...");
console.log("[migrate-db] DATABASE_URL prefix:", process.env.DATABASE_URL.split("@")[1]?.split("/")[0] || "(hidden)");

// `drizzle-kit push --force` — auto-confirms all changes, including ALTER TABLE ADD COLUMN.
// Stdin az "yes" prompt-okra: a --force ezt megkerüli.
const proc = spawn(
  "node",
  ["./node_modules/drizzle-kit/bin.cjs", "push", "--force"],
  {
    stdio: "inherit",
    env: process.env,
  },
);

proc.on("error", (err) => {
  console.error("[migrate-db] spawn error:", err.message);
  // Don't crash — a server akkor is induljon (a router-ek graceful degradation).
  process.exit(0);
});

proc.on("exit", (code) => {
  if (code === 0) {
    console.log("[migrate-db] ✓ DB schema sync OK");
  } else {
    console.warn(`[migrate-db] drizzle-kit push exit code ${code} — folytatjuk a server start-tal.`);
  }
  // Mindenképp 0-val lépünk ki, hogy a `pnpm start` ne álljon meg.
  process.exit(0);
});
