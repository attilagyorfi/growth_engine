/**
 * G2A Growth Engine – idempotens DB schema bootstrap (TiDB-kompatibilis)
 *
 * MIÉRT NEM a Drizzle migrate()?
 * --------------------------------
 * A Drizzle migrátor egy migration fájlt CSAK akkor jelöl "késznek", ha az EGÉSZ
 * fájl hibátlanul lefutott. TiDB-ben (mint minden MySQL-ben) a CREATE TABLE
 * azonban AUTO-COMMIT-ol (implicit commit minden DDL után). Ezért ha egy fájl
 * félúton elbukik:
 *   - a már létrejött táblák VÉGLEGESÍTŐDNEK (bent maradnak),
 *   - de a migration NINCS elkönyvelve a __drizzle_migrations journalban,
 *   - újrafutáskor a Drizzle elölről próbálja a fájlt → "Table already exists"
 *     → ÖRÖK ELAKADÁS (pontosan ez történt a 0004 migrationnél).
 *
 * EZ A SCRIPT IDEMPOTENS:
 * -----------------------
 *   - CREATE TABLE  →  CREATE TABLE IF NOT EXISTS  (létező táblát átugor)
 *   - "already exists" / "Duplicate column" / "Duplicate key" hibákat lenyeli
 *   - Bármilyen deploy-on biztonságosan újrafuttatható, ADATVESZTÉS NÉLKÜL
 *   - Kijavítja a jelenlegi félig-migrált állapotot is
 *
 * Hibatűrő: ha bármi váratlan crash, exit 0 — a server akkor is elindul a
 * healthcheckhez (graceful degradation).
 */
import mysql from "mysql2/promise";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MIGRATIONS_DIR = "./drizzle";

// Hibák, amiket idempotensen LENYELÜNK (a kívánt állapot már fennáll):
const IGNORABLE_FRAGMENTS = [
  "already exists", // Table 'x' already exists
  "duplicate column name", // ADD COLUMN amely már létezik
  "duplicate key name", // index amely már létezik
  "duplicate foreign key", // FK amely már létezik
];

function isIgnorable(message) {
  const m = (message || "").toLowerCase();
  return IGNORABLE_FRAGMENTS.some((frag) => m.includes(frag));
}

/**
 * Egy migration fájl tartalmát különálló SQL utasításokra bontja,
 * és a CREATE TABLE-t idempotenssé teszi.
 * Exportált, hogy lokálisan (DB nélkül) tesztelhető legyen.
 */
export function parseStatements(sqlText) {
  return sqlText
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((stmt) => {
      // CREATE TABLE `x`  →  CREATE TABLE IF NOT EXISTS `x`
      // (csak ha még nincs IF NOT EXISTS)
      const idempotent = stmt.replace(
        /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)`/i,
        "CREATE TABLE IF NOT EXISTS `",
      );
      // A futtatáshoz a trailing `;`-t leszedjük (egy utasítást futtatunk).
      return idempotent.replace(/;\s*$/, "");
    });
}

const isTiDB = (process.env.DATABASE_URL || "").includes("tidbcloud.com");

async function main() {
  // CLI teszt-mód: `node scripts/migrate-db.mjs --dry-run` — csak parse, nincs DB.
  const DRY_RUN = process.argv.includes("--dry-run");

  if (!DRY_RUN && !process.env.DATABASE_URL) {
    console.log(
      "[migrate-db] DATABASE_URL nincs beállítva — skipping migration.",
    );
    return;
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (DRY_RUN) {
    console.log(`[migrate-db] DRY-RUN — ${files.length} migration fájl`);
    let total = 0;
    for (const file of files) {
      const stmts = parseStatements(
        readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
      );
      total += stmts.length;
      const creates = stmts.filter((s) =>
        /CREATE TABLE IF NOT EXISTS/i.test(s),
      ).length;
      const alters = stmts.filter((s) => /^ALTER TABLE/i.test(s)).length;
      console.log(
        `  ${file}: ${stmts.length} utasítás (${creates} CREATE, ${alters} ALTER)`,
      );
    }
    console.log(
      `[migrate-db] DRY-RUN OK — összesen ${total} utasítás, mind parse-olható.`,
    );
    return;
  }

  const hostFragment =
    process.env.DATABASE_URL.split("@")[1]?.split("/")[0] || "(hidden)";
  console.log("[migrate-db] DB schema sync start (idempotens mód)...");
  console.log(`[migrate-db] Host: ${hostFragment}`);
  console.log(
    `[migrate-db] TiDB Cloud detected: ${isTiDB} (SSL ${isTiDB ? "enabled" : "disabled"})`,
  );

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    // TiDB Cloud Serverless kötelezően TLS-t igényel.
    ssl: isTiDB ? { rejectUnauthorized: true } : undefined,
    multipleStatements: false,
  });

  try {
    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      const statements = parseStatements(
        readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
      );

      for (const sql of statements) {
        try {
          await connection.query(sql);
          applied++;
        } catch (e) {
          if (isIgnorable(e.message)) {
            skipped++;
          } else {
            // Valódi hiba → továbbdobjuk, hogy lássuk a logban.
            throw new Error(`[${file}] ${e.message}\n  SQL: ${sql.slice(0, 240)}`);
          }
        }
      }
      console.log(`[migrate-db] ✓ ${file}`);
    }

    console.log(
      `[migrate-db] ✓ Schema sync kész — ${applied} utasítás alkalmazva, ${skipped} kihagyva (már létezett)`,
    );
  } finally {
    try {
      await connection.end();
    } catch {
      // ignore
    }
  }
}

// Csak akkor futtatjuk, ha közvetlenül indítják (nem importáláskor).
const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.warn("[migrate-db] Migration error:", err.message);
      if (err.stack) console.warn("[migrate-db] Stack:", err.stack);
      console.warn(
        "[migrate-db] Folytatjuk a server start-tal (graceful degradation).",
      );
      process.exit(0);
    });
}
