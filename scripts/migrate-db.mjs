/**
 * G2A Growth Engine – DB migration runner (mysql2 direct + drizzle-orm migrator)
 *
 * MIÉRT NEM drizzle-kit push?
 * - A drizzle-kit CLI a `dbCredentials.ssl` config-ot ignorálja TiDB-vel
 * - Eredmény: "Connections using insecure transport are prohibited"
 * - A server-side mysql2 viszont megfelelően kezeli az SSL-t
 *
 * Ez a script bypass-olja a drizzle-kit-et:
 * - Közvetlenül mysql2/promise-szal csatlakozik (ssl: { rejectUnauthorized: true })
 * - drizzle-orm/mysql2/migrator `migrate()` function-t használja
 * - Felhasználja a meglévő drizzle/*.sql migration fájlokat (15 db)
 * - A drizzle/meta/_journal.json tracking-eli, mely migrationok futottak már
 *
 * Idempotens: ha minden már fent van, az `__drizzle_migrations` tábla
 * journal-ja alapján a migrator skippeli a már alkalmazott migrationoket.
 *
 * Hibatűrő: ha bármi crash, exit 0 — a server akkor is elindul a healthcheckhez.
 */
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

if (!process.env.DATABASE_URL) {
  console.log("[migrate-db] DATABASE_URL nincs beállítva — skipping migration.");
  process.exit(0);
}

const isTiDB = process.env.DATABASE_URL.includes("tidbcloud.com");
const hostFragment = process.env.DATABASE_URL.split("@")[1]?.split("/")[0] || "(hidden)";
console.log("[migrate-db] DB schema sync start...");
console.log(`[migrate-db] Host: ${hostFragment}`);
console.log(`[migrate-db] TiDB Cloud detected: ${isTiDB} (SSL ${isTiDB ? "enabled" : "disabled"})`);

let connection;
try {
  connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    // TiDB Cloud Serverless kötelezően TLS-t igényel.
    // rejectUnauthorized: true → ellenőrzi a CA-t (TiDB Cloud-nak valid Let's Encrypt cert-je van).
    ssl: isTiDB ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true,
  });

  const db = drizzle(connection);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate-db] ✓ All migrations applied successfully");

  await connection.end();
  process.exit(0);
} catch (err) {
  console.warn("[migrate-db] Migration error:", err.message);
  console.warn("[migrate-db] Stack:", err.stack);
  // Cleanup ha lehet
  if (connection) {
    try {
      await connection.end();
    } catch {
      // ignore
    }
  }
  // Mindenképp 0-val lépünk ki, hogy a server elinduljon a healthcheck-hez.
  console.warn("[migrate-db] Folytatjuk a server start-tal (graceful degradation).");
  process.exit(0);
}
