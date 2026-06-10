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
const META_DIR = "./drizzle/meta";

// TiDB nem engedi a DEFAULT értéket text/json/blob típusú oszlopokon.
const NO_DEFAULT_TYPES =
  /^(text|json|blob|longtext|mediumtext|tinytext|longblob|mediumblob|tinyblob)\b/i;

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

/**
 * Egy oszlop-definícióból (drizzle snapshot formátum) TiDB-biztos
 * `ADD COLUMN` DDL-töredéket épít.
 */
function columnDdl(col) {
  let ddl = `\`${col.name}\` ${col.type}`;
  if (col.notNull) ddl += " NOT NULL";
  // TEXT/JSON/BLOB típuson a TiDB tiltja a DEFAULT-ot → kihagyjuk.
  if (col.default !== undefined && !NO_DEFAULT_TYPES.test(col.type)) {
    const d = typeof col.default === "boolean" ? String(col.default) : col.default;
    ddl += ` DEFAULT ${d}`;
  }
  return ddl;
}

/**
 * Önjavító oszlop-szinkron: a legutóbbi drizzle snapshot (= schema.ts igazság)
 * alapján pótolja a már LÉTEZŐ táblákból hiányzó oszlopokat.
 *
 * MIÉRT KELL? A `CREATE TABLE IF NOT EXISTS` nem javítja meg a már létező,
 * de hiányos táblát (pl. egy korábbi félkész migration-futás öröksége). Ez a
 * lépés garantálja, hogy a telepített séma egyezzen a schema.ts-szel.
 */
async function syncColumnsFromSnapshot(connection) {
  let snapFiles;
  try {
    snapFiles = readdirSync(META_DIR)
      .filter((f) => f.endsWith("_snapshot.json"))
      .sort();
  } catch {
    return;
  }
  if (!snapFiles.length) return;
  const latest = snapFiles[snapFiles.length - 1];
  let snap;
  try {
    snap = JSON.parse(readFileSync(join(META_DIR, latest), "utf8"));
  } catch {
    return;
  }

  const [rows] = await connection.query(
    "SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE()",
  );
  const actual = {};
  for (const r of rows) {
    const t = r.t ?? r.table_name ?? r.TABLE_NAME;
    const c = r.c ?? r.column_name ?? r.COLUMN_NAME;
    (actual[t] = actual[t] || new Set()).add(c);
  }

  let added = 0;
  for (const [table, def] of Object.entries(snap.tables || {})) {
    const have = actual[table];
    if (!have) continue; // a táblát a migrationnek kell létrehoznia
    for (const col of Object.values(def.columns || {})) {
      if (have.has(col.name)) continue;
      const ddl = `ALTER TABLE \`${table}\` ADD ${columnDdl(col)}`;
      try {
        await connection.query(ddl);
        console.log(`[migrate-db] + hiányzó oszlop pótolva: ${table}.${col.name}`);
        added++;
      } catch (e) {
        if (!isIgnorable(e.message)) {
          console.warn(
            `[migrate-db] ! nem sikerült pótolni ${table}.${col.name}: ${e.message}`,
          );
        }
      }
    }
  }
  console.log(
    added
      ? `[migrate-db] ✓ Oszlop-szinkron: ${added} hiányzó oszlop pótolva.`
      : `[migrate-db] ✓ Oszlop-szinkron: minden oszlop a helyén.`,
  );
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

    // Önjavító oszlop-szinkron: pótolja a hiányos táblák oszlopait a snapshot alapján.
    await syncColumnsFromSnapshot(connection);
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
