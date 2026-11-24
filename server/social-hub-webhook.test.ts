/**
 * G2 – Social Hub webhook-fogadó, állapot, értesítés, AI-memória és titok (0027).
 *
 * Valódi adatbázis és Social Hub nélkül: a valódi drizzle-SQL egy memóriabeli, tranzakciós
 * hamis mysql2-poolon fut (a tranzakciók sorban mennek, a valódi zárolást a kiadott SQL
 * alapján ellenőrizzük). A HTTP-kérések a helyi gépen maradnak.
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableConfig } from "drizzle-orm/mysql-core";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-characters-000000";
  return { db: null as any, publish: null as any };
});
vi.mock("mysql2/promise", () => ({ default: { createPool: () => { throw new Error("tilos"); } } }));
vi.mock("./db", async (orig) => ({
  ...(await orig<typeof import("./db")>()),
  getDb: async () => h.db,
  getProfileById: async (id: string) => ({ id, name: "VIBA", appUserId: `owner-${id}`, externalRef: "viba" }),
}));
vi.mock("./publishing", async (orig) => ({
  ...(await orig<typeof import("./publishing")>()),
  publishWithConnection: (...args: unknown[]) => h.publish(...args),
}));

import * as schema from "../drizzle/schema";
import { ENV } from "./_core/env";
import { PROFILE_OWNED_TABLES } from "./db";
import { appRouter } from "./routers";
import { runSchedulerOnce } from "./scheduler";
import { encryptApiKey, resolveWebhookSecret } from "./socialHub/config";
import { buildDraft, buildDraftsBody, buildPostContent, hashDraftContent } from "./socialHub/drafts";
import { applyEvent, EMPTY_POST_STATE, visibleState, type VisibleState } from "./socialHub/postState";
import { MAX_WEBHOOK_BYTES, registerSocialHubWebhook, SOCIAL_HUB_WEBHOOK_PATH } from "./socialHub/webhook";
import { matchSentDraft, MAX_MEMORY_LENGTH } from "./socialHub/webhookStore";

const SECRET = "whsec_TITKOS-teszt-titok-1234567890";
const CLIENT = "00000000-0000-4000-8000-000000000001";
const OTHER_CLIENT = "00000000-0000-4000-8000-000000000002";
const ACCOUNT = "00000000-0000-4000-8000-000000000010";
const T0 = Date.parse("2026-11-20T10:00:00.000Z");

// ─── Memóriabeli hamis MySQL ─────────────────────────────────────────────────

type Row = Record<string, any>;
let tables: Record<string, Row[]>;
let log: { sql: string; conn: string }[];
/** Hibabefecskendezés: ha dob, az utasítás hibázik. */
let before: (sql: string) => void;

const UNIQUE: Record<string, string[][]> = {
  social_hub_webhook_secret: [["id"]], social_hub_connection: [["id"]], social_hub_webhook_events: [["eventId"]],
  social_hub_post_states: [["socialHubPostId"]], social_hub_memory_marks: [["id"], ["postId", "decision"]],
};
const DEFAULTS: Record<string, Row> = { app_notifications: { isRead: 0 }, ai_memories: { weight: 1 } };
const norm = (v: any) => (v === true ? 1 : v === false ? 0 : v ?? null);

function predicate(where: string, next: () => any): (row: Row) => boolean {
  const clauses = where.replace(/^\((.*)\)$/, "$1").split(" and ").map((c) => {
    let m = /^json_contains\(`\w+`\.`(\w+)`, json_quote\(\?\)\)$/.exec(c);
    if (m) { const [col, v] = [m[1], next()]; return (r: Row) => r[col].includes(v); }
    m = /^`\w+`\.`(\w+)` is not null$/.exec(c);
    if (m) { const col = m[1]; return (r: Row) => norm(r[col]) !== null; }
    m = /^`\w+`\.`(\w+)` in \(([?, ]+)\)$/.exec(c);
    if (m) { const col = m[1]; const list = m[2].split(",").map(() => next()); return (r: Row) => list.includes(r[col]); }
    m = /^`\w+`\.`(\w+)` (=|<>|<=|>=) \?$/.exec(c);
    if (!m) throw new Error(`ismeretlen feltétel: ${c}`);
    const [col, op, v] = [m[1], m[2], norm(next())];
    return (r: Row) => {
      const x = norm(r[col]);
      if (x === null || v === null) return false;
      return op === "=" ? x === v : op === "<>" ? x !== v : op === "<=" ? x <= v : x >= v;
    };
  });
  return (row) => clauses.every((c) => c(row));
}

function execute(sql: string, input: any[]): any {
  let i = 0;
  const next = () => input[i++];
  let m = /^select (.*?) from `(\w+)`(?: where (.*?))?(?: order by (.*?))?(?: limit \?)?( for update)?$/.exec(sql);
  if (m) {
    const [, list, name, where] = m;
    let rows = tables[name] ?? [];
    if (where) rows = rows.filter(predicate(where, next));
    if (list === "count(*)") return [[rows.length]];
    const order = /^`\w+`\.`(\w+)` desc/.exec(m[4] ?? "");
    if (order) rows = [...rows].sort((a, b) => (a[order[1]] < b[order[1]] ? 1 : -1));
    if (/ limit \?/.test(sql)) rows = rows.slice(0, next());
    return rows.map((r) => list.split(", ").map((c) => norm(r[c.replace(/`/g, "")])));
  }
  m = /^insert into `(\w+)` \((.*?)\) values (.*?)( on duplicate key update .*)?$/.exec(sql);
  if (m) {
    const [, name, cols, values, upsert] = m;
    const names = cols.split(", ").map((c) => c.replace(/`/g, ""));
    for (const tuple of values.slice(1, -1).split("), (")) {
      const row: Row = {};
      tuple.split(", ").forEach((v, k) => { row[names[k]] = v === "default" ? DEFAULTS[name]?.[names[k]] ?? null : norm(next()); });
      const clash = (tables[name] ??= []).find((r) => (UNIQUE[name] ?? []).some((key) => key.every((c) => r[c] === row[c])));
      if (clash && !upsert) throw Object.assign(new Error("Duplicate entry SZIVARGAS"), { code: "ER_DUP_ENTRY", errno: 1062 });
      if (clash) Object.assign(clash, row); else tables[name].push(row);
    }
    return { affectedRows: 1 };
  }
  m = /^update `(\w+)` set (.*?) where (.*)$/.exec(sql);
  if (m) {
    const set = Object.fromEntries(m[2].split(", ").map((s) => [/`(\w+)` = \?/.exec(s)![1], norm(next())]));
    const rows = (tables[m[1]] ?? []).filter(predicate(m[3], next));
    rows.forEach((r) => Object.assign(r, set));
    return { affectedRows: rows.length };
  }
  m = /^delete from `(\w+)` where (.*)$/.exec(sql);
  if (m) {
    const drop = predicate(m[2], next);
    tables[m[1]] = (tables[m[1]] ?? []).filter((r) => !drop(r));
    return { affectedRows: 1 };
  }
  throw new Error(`ismeretlen SQL: ${sql}`);
}

function fakeDb() {
  let queue = Promise.resolve();
  const connection = (conn: string) => {
    let snapshot: typeof tables;
    let release = () => {};
    const query = async (q: any, params: any[] = []) => {
      const sql = typeof q === "string" ? q : q.sql;
      if (sql === "begin") {
        const previous = queue;
        queue = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        snapshot = structuredClone(tables);
      }
      log.push({ sql, conn });
      if (/^(begin|commit|rollback)/.test(sql)) {
        if (sql === "rollback") tables = snapshot!;
        if (sql !== "begin") release();
        return [{}];
      }
      before(sql);
      return [execute(sql, params), []];
    };
    return { query, execute: query };
  };
  return drizzle({ ...connection("pool"), getConnection: async () => ({ ...connection("tx"), release: () => {} }) } as any);
}

const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, -1).replace("T", " ");
const writes = () => log.filter((c) => /^(insert|update|delete|begin)/.test(c.sql));
const missing = (name: string) => (sql: string) => {
  if (sql.includes(`\`${name}\``)) throw Object.assign(new Error("SZIVARGAS"), { code: "ER_NO_SUCH_TABLE", errno: 1146 });
};

// ─── Kiinduló adatok ─────────────────────────────────────────────────────────

const post = (id: string, over: Row = {}): Row => ({
  id, profileId: "p-a", title: `Cím ${id}`, platform: "linkedin", content: `Küldéskori szöveg ${id}`, hashtags: ["teszt"], imageUrl: null,
  pillar: "Szakértelem", status: "approved", scheduledAt: null, publishedAt: null, ...over,
});
/** Sikeres küldés a naplóban; a socialHubPostId `sh-<poszt>`. */
function seedSent(p: Row, over: { client?: string; profileId?: string; hubPost?: string; attempt?: string; sentAt?: number } = {}) {
  const built = buildPostContent(p as any);
  if (!built.ok) throw new Error("hibás poszt");
  const { client = CLIENT, profileId = p.profileId, hubPost = `sh-${p.id}`, attempt = `at-${p.id}`, sentAt = T0 } = over;
  tables.social_hub_send_attempts.push({
    id: attempt, profileId, socialHubClientId: client, status: "sent", postIds: ["elotte", p.id], lastTriedAt: sqlTime(sentAt),
    body: buildDraftsBody([buildDraft({ text: "Másik poszt" }, ACCOUNT), buildDraft(built.content, ACCOUNT)]),
  });
  tables.social_hub_post_deliveries.push({
    id: `dl-${hubPost}`, profileId, postId: p.id, socialHubClientId: client, status: "sent", attemptId: attempt,
    contentHash: built.hash, sentHash: built.hash, socialHubPostId: hubPost, sentAt: sqlTime(sentAt),
  });
}
const theDelivery = (id = "a") => tables.social_hub_post_deliveries.find((d) => d.postId === id)!;
const thePost = (id = "a") => tables.content_posts.find((p) => p.id === id)!;

let logs: string[];
let servers: Server[];
let passedOn: string[];
beforeEach(() => {
  log = []; logs = []; servers = []; passedOn = []; before = () => {};
  h.db = fakeDb();
  h.publish = vi.fn(async () => ({ postId: "li-1" }));
  tables = {
    social_hub_webhook_secret: [{ id: "default", secretEnc: encryptApiKey(SECRET), updatedBy: "u", updatedAt: sqlTime(T0) }],
    social_hub_send_attempts: [], social_hub_post_deliveries: [],
    content_posts: [post("a"), post("b"), post("x", { profileId: "p-b" })],
    app_users: [
      { id: "u-1", profileId: "p-a", active: 1 }, { id: "u-2", profileId: "p-a", active: 1 },
      { id: "u-3", profileId: "p-a", active: 0 }, { id: "u-b", profileId: "p-b", active: 1 },
    ],
    social_connections: [{ id: "c-1", profileId: "p-a", platform: "linkedin", isActive: 1, platformUsername: "x", tokenExpiresAt: null }],
  };
  seedSent(post("a"));
  vi.stubEnv("DATABASE_URL", "mysql://teszt@localhost/teszt");
  vi.stubEnv("SOCIAL_HUB_API_URL", ""); vi.stubEnv("SOCIAL_HUB_API_KEY", "");
  for (const m of ["error", "warn", "log"] as const) vi.spyOn(console, m).mockImplementation((...x) => { logs.push(x.map(String).join(" ")); });
});
afterEach(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => { s.closeAllConnections(); s.close(r); })));
  expect(logs.join("\n")).not.toMatch(/TITKOS|whsec_|sha256=|SZIVARGAS|TORZS-JEL|Failed query|\n\s+at /);
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});

// ─── Kérések ─────────────────────────────────────────────────────────────────

async function listen(handler: any): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}${SOCIAL_HUB_WEBHOOK_PATH}`;
}
let url: string;
beforeEach(async () => {
  const app = express();
  registerSocialHubWebhook(app);
  app.use((_req, _res, next) => { passedOn.push("next"); next(); });
  app.use(express.json());
  app.use((_err: unknown, _req: any, res: any, _next: any) => { passedOn.push("error"); res.status(599).end(); });
  url = await listen(app);
});

let seq = 0;
type EventOver = { id?: string; type?: string; at?: number; hubPost?: string; client?: string; data?: Row };
const event = (over: EventOver = {}) => ({
  id: over.id ?? `ev-${++seq}`, type: over.type ?? "post.approved", created_at: new Date(over.at ?? T0).toISOString(),
  data: { post_id: over.hubPost ?? "sh-a", client_id: over.client ?? CLIENT, client_external_ref: null, organization_id: "org", status: "X", ...over.data },
});
type SendOver = { secret?: string; timestamp?: string; headers?: Record<string, string | undefined>; sentBody?: string | Buffer; to?: string };
async function deliver(ev: any, over: SendOver = {}) {
  const body = typeof ev === "string" ? ev : JSON.stringify(ev);
  const parsed = typeof ev === "string" ? { id: "ev-x", type: "post.approved" } : ev;
  const timestamp = over.timestamp ?? String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string | undefined> = {
    "Content-Type": "application/json", "X-SocialHub-Event-Id": String(parsed.id), "X-SocialHub-Event": String(parsed.type),
    "X-SocialHub-Timestamp": timestamp,
    "X-SocialHub-Signature": `sha256=${createHmac("sha256", over.secret ?? SECRET).update(`${timestamp}.${body}`).digest("hex")}`,
    ...over.headers,
  };
  const res = await fetch(over.to ?? url, {
    method: "POST", body: over.sentBody ?? body, headers: Object.fromEntries(Object.entries(headers).filter((e): e is [string, string] => e[1] !== undefined)),
  });
  const text = await res.text();
  expect(text).not.toMatch(/TITKOS|whsec_|sha256|TORZS-JEL|SZIVARGAS|at .*\.ts|select|insert/);
  return res.status;
}
const send = (over: EventOver = {}) => deliver(event(over));
const visible = async (profileId = "p-a") =>
  Object.fromEntries((await caller().postStates({ profileId })).map((s: any) => [s.postId, s.status]));
const caller = (role = "user") => appRouter.createCaller({ appUser: { id: "u-1", role, profileId: "p-a" }, req: {}, res: {} } as any).socialHub;
const rows = (name: string) => tables[name] ?? [];

// ─── Migráció ────────────────────────────────────────────────────────────────

describe("0027-es migráció", () => {
  const statements = readFileSync("drizzle/0027_social_hub_webhook.sql", "utf8").replace(/\r/g, "").split("--> statement-breakpoint")
    .map((s) => s.split("\n").filter((l) => !l.startsWith("--")).join("\n").trim());
  const tablesOf = [schema.socialHubWebhookSecret, schema.socialHubWebhookEvents, schema.socialHubPostStates, schema.socialHubMemoryMarks];

  it("csak CREATE TABLE IF NOT EXISTS új táblákra, a schema.ts-sel egyezően", () => {
    expect(statements).toHaveLength(4);
    statements.forEach((s, i) => {
      expect(s).toMatch(/^CREATE TABLE IF NOT EXISTS `\w+` \(\n[^;]*\n\);$/);
      expect(s).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|INDEX|REFERENCES)\b/);
      const config = getTableConfig(tablesOf[i]);
      expect(/EXISTS `(\w+)`/.exec(s)![1]).toBe(config.name);
      const columns = s.split("\n").map((l) => l.trim().replace(/,$/, "")).filter((l) => l.startsWith("`"));
      expect(columns).toEqual(config.columns.map((c) => `\`${c.name}\` ${c.getSQLType()}${c.notNull ? " NOT NULL" : " NULL"}${c.hasDefault ? " DEFAULT (now())" : ""}`));
      const primary = config.columns.find((c) => c.primary)!.name;
      expect(s).toContain(`PRIMARY KEY(\`${primary}\`)`);
    });
    expect(getTableConfig(schema.socialHubMemoryMarks).uniqueConstraints[0].columns.map((c) => c.name)).toEqual(["postId", "decision"]);
    expect(statements[3]).toContain("UNIQUE(`postId`,`decision`)");
  });

  it("a journalban a 0026 után áll, a profilos táblák a profiltörlésben", () => {
    const { entries } = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    const at = entries.findIndex((e: any) => e.tag === "0027_social_hub_webhook");
    expect(entries[at]).toMatchObject({ idx: 18 });
    expect(entries[at].when).toBeGreaterThan(entries[at - 1].when);
    expect(PROFILE_OWNED_TABLES).toEqual(expect.arrayContaining(["socialHubWebhookEvents", "socialHubPostStates", "socialHubMemoryMarks"]));
    expect(PROFILE_OWNED_TABLES).not.toContain("socialHubWebhookSecret");
  });
});

// ─── Belépők ─────────────────────────────────────────────────────────────────

describe("belépők", () => {
  it.each(["server/_core/index.ts", "api/[...path].ts"])("%s: ugyanaz a regisztráló, az express.json előtt", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/import \{ registerSocialHubWebhook \} from ".*\/socialHub\/webhook(\.js)?"/);
    const at = source.indexOf("registerSocialHubWebhook(app);");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(source.indexOf("app.use(express.json("));
  });

  // Szóközös, escape-elt és ékezetes törzs: csak a bájtra pontos aláírás-ellenőrzés fogadja el.
  const oddBody = (id: string) =>
    `{ "type" : "post.approved",\n  "id":"${id}", "created_at":"2026-11-20T10:00:00.123Z", "data":{"post_id":"sh-a","client_id":"${CLIENT}","x":"\\u00e1 é 😀"} }`;

  it("a közös regisztráló a nyers bájtokat ellenőrzi", async () => {
    expect(await deliver(oddBody("ev-x"))).toBe(200);
    expect(rows("social_hub_post_states")).toMatchObject([{ latestStatus: "approved", latestAtMs: T0 + 123 }]);
  });

  it("az api/[...path].ts handlerén át is, akkor is, ha a platform maga értelmezné a törzset", async () => {
    const { default: handler } = await import("../api/[...path]");
    const getter = vi.fn(() => { throw new Error("Invalid JSON"); });
    const to = await listen((req: any, res: any) => {
      Object.defineProperty(req, "body", { configurable: true, enumerable: true, get: getter, set: () => {} });
      handler(req, res);
    });
    expect(await deliver(oddBody("ev-x"), { to })).toBe(200);
    expect(rows("social_hub_webhook_events")).toMatchObject([{ eventId: "ev-x" }]);
    expect(await deliver(oddBody("ev-x"), { to, secret: "whsec_rossz" })).toBe(401);
    expect(getter).not.toHaveBeenCalled();
  });
});

// ─── Fogadó ──────────────────────────────────────────────────────────────────

describe("aláírás és védelem", () => {
  const nowS = () => Math.floor(Date.now() / 1000);

  it("hibás kérés: 401, JSON-értelmezés és adatbázis-írás nélkül", async () => {
    const ev = event({ data: { x: "TORZS-JEL" } });
    const parse = vi.spyOn(JSON, "parse");
    const good = JSON.stringify(ev);
    const cases: SendOver[] = [
      { secret: "whsec_masik-titok-000000000" },
      { headers: { "X-SocialHub-Signature": undefined } },
      { headers: { "X-SocialHub-Signature": "sha256=" } },
      { headers: { "X-SocialHub-Signature": `sha256=${"a".repeat(64)}` } },
      { headers: { "X-SocialHub-Signature": createHmac("sha256", SECRET).update(`${nowS()}.${good}`).digest("hex") } },
      { headers: { "X-SocialHub-Timestamp": undefined } },
      { sentBody: `${good} ` },
      { timestamp: String(nowS() - 310) }, { timestamp: String(nowS() + 310) },
      { timestamp: `${nowS()}.5` }, { timestamp: "1e9" }, { timestamp: "-1" }, { timestamp: "abc" }, { timestamp: `0x${nowS().toString(16)}` },
    ];
    for (const c of cases) expect(await deliver(ev, c), JSON.stringify(c)).toBe(401);
    expect(parse.mock.calls.filter(([text]) => String(text).includes("TORZS-JEL"))).toHaveLength(0);
    expect(writes()).toHaveLength(0);
    expect(passedOn).toEqual([]);
  });

  it("a tűrésen belüli időbélyeg jó; az érvénytelen JSON csak jó aláírással 400", async () => {
    expect(await deliver(event(), { timestamp: String(nowS() - 290) })).toBe(200);
    expect(await deliver(event(), { timestamp: String(nowS() + 290) })).toBe(200);
    expect(await deliver("{ nem json")).toBe(400);
    expect(await deliver("{ nem json", { secret: "whsec_rossz" })).toBe(401);
    for (const body of ["null", "[]", "\"x\"", "{}"]) expect(await deliver(body)).toBe(400);
  });

  it("hiányzó, visszafejthetetlen vagy olvashatatlan titok: 503", async () => {
    const stored = tables.social_hub_webhook_secret[0];
    for (const secretEnc of [SECRET, "enc:v1:rossz", "enc:v1:AAAA:BBBB:CCCC"]) {
      stored.secretEnc = secretEnc;
      expect(await send()).toBe(503);
    }
    // A tokenCrypto a visszafejtési hibát (titok nélkül) maga naplózza.
    logs = [];
    tables.social_hub_webhook_secret = [];
    expect(await send()).toBe(503);
    before = missing("social_hub_webhook_secret");
    expect(await send()).toBe(503);
    h.db = null;
    expect(await send()).toBe(503);
    vi.stubEnv("DATABASE_URL", "");
    expect(await send()).toBe(503);
    expect(writes()).toHaveLength(0);
  });

  it("túl nagy, tömörített, üres vagy más típusú törzs: elutasítva, semmi nem jut tovább", async () => {
    expect(await deliver(event({ data: { x: "TORZS-JEL".repeat(MAX_WEBHOOK_BYTES / 8) } }))).toBe(413);
    expect(await deliver(event(), { headers: { "Content-Encoding": "gzip" } })).toBe(415);
    expect((await fetch(url, { method: "POST" })).status).toBe(401);
    expect(await deliver("{ rossz", { secret: "whsec_rossz", headers: { "Content-Type": "application/json; charset=ismeretlen" } })).toBe(401);
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", "ez/is;rossz;;"]) {
      expect(await deliver(event(), { headers: { "Content-Type": type } })).toBe(200);
      expect(await deliver(event(), { headers: { "Content-Type": type }, secret: "whsec_rossz" })).toBe(401);
    }
    expect(passedOn).toEqual([]);
  });

  it("a fejléc és a törzs azonosítójának vagy típusának eltérése 400, mellékhatás nélkül", async () => {
    expect(await deliver(event(), { headers: { "X-SocialHub-Event-Id": "masik" } })).toBe(400);
    expect(await deliver(event(), { headers: { "X-SocialHub-Event-Id": undefined } })).toBe(400);
    expect(await deliver(event(), { headers: { "X-SocialHub-Event": "post.published" } })).toBe(400);
    expect(await deliver({ ...event(), created_at: "tegnap" })).toBe(400);
    expect(await deliver({ ...event(), data: { post_id: 5 } })).toBe(400);
    expect(writes()).toHaveLength(0);
  });

  it("ismeretlen típus, poszt vagy ügyfél: 200, egyetlen táblába sem íródik semmi", async () => {
    const start = structuredClone(tables);
    expect(await deliver({ id: "ev-u", type: "post.archived", valami: 1 })).toBe(200);
    expect(await deliver({ id: "ev-u2", type: "constructor" })).toBe(200);
    expect(writes()).toHaveLength(0);
    expect(await send({ hubPost: "sh-ismeretlen" })).toBe(200);
    expect(await send({ client: OTHER_CLIENT, type: "post.published" })).toBe(200);
    expect(tables).toEqual(start);
    expect(log.filter((c) => /^(insert|update|delete)/.test(c.sql))).toHaveLength(0);
  });

  it("feldolgozási hibánál minden visszagördül és nem-2xx; az újraküldés sikeres", async () => {
    const start = structuredClone(tables);
    const ev = event({ type: "post.changes_requested" });
    for (const at of [/^insert into `social_hub_webhook_events`/, /^insert into `social_hub_post_states`/, /^insert into `app_notifications`/, /^insert into `ai_memories`/]) {
      before = (sql) => { if (at.test(sql)) throw Object.assign(new Error("SZIVARGAS"), { code: "ER_LOCK_DEADLOCK" }); };
      expect(await deliver(ev)).toBeGreaterThanOrEqual(500);
      expect(tables).toEqual(start);
    }
    expect(logs.join()).toContain("ER_LOCK_DEADLOCK");
    before = () => {};
    expect(await deliver(ev)).toBe(200);
    expect(rows("social_hub_webhook_events")).toHaveLength(1);
    expect(rows("app_notifications")).toHaveLength(2);
    expect(rows("ai_memories")).toHaveLength(1);
  });

  it("ugyanaz az esemény egyszer hat, párhuzamosan is", async () => {
    const ev = event({ type: "post.changes_requested" });
    expect(await Promise.all([deliver(ev), deliver(ev), deliver(ev)])).toEqual([200, 200, 200]);
    const after = structuredClone(tables);
    expect(await deliver(ev)).toBe(200);
    expect(tables).toEqual(after);
    expect(rows("social_hub_webhook_events")).toHaveLength(1);
    expect(rows("app_notifications")).toHaveLength(2);
  });

  it("a döntést megalapozó olvasások zárolók, a napló elsődleges kulcsra, a kísérlet zárolása nélkül", async () => {
    await send({ type: "post.changes_requested" });
    const tx = log.filter((c) => c.conn === "tx").map((c) => c.sql);
    expect(tx[0]).toBe("begin");
    expect(tx.at(-1)).toBe("commit");
    const locks = tx.filter((s) => s.endsWith("for update"));
    expect(locks.map((s) => /from `(\w+)`/.exec(s)![1])).toEqual(["social_hub_post_deliveries", "content_posts", "social_hub_post_states", "app_notifications"]);
    expect(locks[0]).toContain("where `social_hub_post_deliveries`.`id` = ? for update");
    // Zárolás nélkül csak a napló-sor keresése, a felhasználók és a küldési kísérletek olvasása megy.
    expect(tx.filter((s) => /^select/.test(s) && !s.endsWith("for update")).map((s) => /from `(\w+)`/.exec(s)![1]))
      .toEqual(["social_hub_post_deliveries", "app_users", "social_hub_send_attempts", "social_hub_send_attempts"]);
  });

  it("a zár utáni újraellenőrzés: a közben felülírt napló-sor eseménye kimarad", async () => {
    before = (sql) => { if (/`social_hub_post_deliveries`\.`id` = \? for update$/.test(sql)) theDelivery().socialHubPostId = "sh-uj"; };
    expect(await send({ type: "post.published" })).toBe(200);
    expect(rows("social_hub_webhook_events")).toHaveLength(0);
    expect(thePost().status).toBe("approved");
  });

  it("másik ügyfél eseménye nem érint idegen profilt; a napló és a poszt profiljának egyeznie kell", async () => {
    seedSent(post("x", { profileId: "p-b" }), { client: OTHER_CLIENT });
    expect(await send({ hubPost: "sh-x", client: CLIENT, type: "post.published" })).toBe(200);
    expect(await send({ hubPost: "sh-a", client: OTHER_CLIENT, type: "post.published" })).toBe(200);
    expect([thePost("a").status, thePost("x").status]).toEqual(["approved", "approved"]);
    expect(await send({ hubPost: "sh-x", client: OTHER_CLIENT, type: "post.published" })).toBe(200);
    expect([thePost("a").status, thePost("x").status]).toEqual(["approved", "published"]);
    expect(await visible()).toEqual({});
    theDelivery().profileId = "p-b";
    expect(await send({ type: "post.published" })).toBe(200);
    expect(thePost("a").status).toBe("approved");
  });
});

// ─── Állapot ─────────────────────────────────────────────────────────────────

describe("állapot és sorrend", () => {
  const ev = (status: VisibleState["status"], atMs: number): VisibleState => ({ status, atMs });
  const permutations = <T,>(list: T[]): T[][] =>
    list.length < 2 ? [list] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((r) => [x, ...r]));
  const reduce = (events: VisibleState[]) => visibleState(events.reduce((r, e) => applyEvent(r, e).record, EMPTY_POST_STATE));

  it.each<[string, VisibleState[], VisibleState]>([
    ["az újabb nyer", [ev("approved", 10), ev("changes_requested", 11)], ev("changes_requested", 11)],
    ["hiba után új jóváhagyás", [ev("failed", 10), ev("approved", 11)], ev("approved", 11)],
    ["jóváhagyás után hiba", [ev("approved", 10), ev("failed", 11)], ev("failed", 11)],
    ["published erősebb az újabb failed-nél", [ev("published", 10), ev("failed", 20)], ev("published", 10)],
    ["közbeeső eseménnyel is", [ev("published", 10), ev("changes_requested", 15), ev("failed", 20)], ev("changes_requested", 15)],
    ["közbeeső régebbi eseménnyel is", [ev("approved", 5), ev("published", 10), ev("failed", 20), ev("failed", 30)], ev("published", 10)],
    ["azonos időnél rangsor", [ev("approved", 10), ev("changes_requested", 10), ev("published", 10), ev("failed", 10)], ev("published", 10)],
  ])("%s, minden érkezési sorrendben", (_name, events, expected) => {
    for (const order of permutations(events)) expect(reduce(order)).toEqual(expected);
  });

  it("ezredmásodpercre pontos; régebbi nem ír felül újabbat", async () => {
    await send({ type: "post.changes_requested", at: T0 + 2 });
    await send({ type: "post.approved", at: T0 + 1 });
    expect(await visible()).toEqual({ a: "changes_requested" });
    await send({ type: "post.approved", at: T0 + 3 });
    expect(await visible()).toEqual({ a: "approved" });
  });

  it.each([["failed előbb", ["post.failed", "post.published"]], ["published előbb", ["post.published", "post.failed"]]])(
    "published > failed (%s), és a poszt megjelentként rögzül", async (_n, order) => {
      for (const type of order) await send({ type, at: type === "post.failed" ? T0 + 5000 : T0 });
      expect(await visible()).toEqual({ a: "published" });
      expect(thePost()).toMatchObject({ status: "published", publishedAt: sqlTime(T0) });
    });

  it("content_posts-ot csak a post.published ír; a meglévő publishedAt marad", async () => {
    const start = { ...thePost() };
    for (const type of ["post.approved", "post.changes_requested", "post.failed"]) await send({ type, at: T0 + ++seq });
    expect(thePost()).toEqual(start);
    expect(log.filter((c) => /^update `content_posts`/.test(c.sql))).toHaveLength(0);
    // A jelvény a sorrend miatt nem változik, a poszt mégis megjelentként rögzül.
    await send({ type: "post.changes_requested", at: T0 + 900_000 });
    await send({ type: "post.published", at: T0 });
    expect(await visible()).toEqual({ a: "changes_requested" });
    expect(thePost()).toEqual({ ...start, status: "published", publishedAt: sqlTime(T0) });
    await send({ type: "post.published", at: T0 + 990_000 });
    expect(thePost().publishedAt).toBe(sqlTime(T0));
  });

  it("jelvény: az aktuális, több napló-sornál a legutóbb sikeresen küldött poszté; jogosultsággal, Social Hub-hívás nélkül", async () => {
    await send({ type: "post.failed" });
    expect(await visible()).toEqual({ a: "failed" });
    // Újraküldés: a régi socialHubPostId állapota nem látszik, és az eseménye már nem hat.
    theDelivery().socialHubPostId = "sh-uj";
    expect(await visible()).toEqual({});
    await send({ type: "post.published" });
    expect(thePost().status).toBe("approved");
    await send({ type: "post.approved", hubPost: "sh-uj" });
    expect(await visible()).toEqual({ a: "approved" });
    // Újrapárosítás után másik ügyfélhez küldve.
    seedSent(post("a"), { client: OTHER_CLIENT, hubPost: "sh-masik", attempt: "at-2", sentAt: T0 + 60_000 });
    expect(await visible()).toEqual({});
    await send({ type: "post.changes_requested", hubPost: "sh-masik", client: OTHER_CLIENT });
    expect(await visible()).toEqual({ a: "changes_requested" });
    theDelivery().status = "uncertain";
    expect(await visible()).toEqual({ a: "changes_requested" });

    await expect(caller().postStates({ profileId: "p-b" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    before = missing("social_hub_post_states");
    expect(await caller().postStates({ profileId: "p-a" })).toEqual([]);
    vi.stubEnv("DATABASE_URL", "");
    expect(await caller().postStates({ profileId: "p-a" })).toEqual([]);
  });
});

// ─── A régi ütemező ──────────────────────────────────────────────────────────

describe("a régi ütemező post.published után", () => {
  const due = () => Object.assign(thePost(), { status: "scheduled", scheduledAt: sqlTime(Date.now() - 60_000) });

  it("a megjelent posztot nem küldi ki; a többi eseménytől semmi nem kerül a sorába", async () => {
    due();
    await send({ type: "post.published" });
    await runSchedulerOnce();
    expect(h.publish).not.toHaveBeenCalled();
    expect(thePost().status).toBe("published");

    tables.content_posts = [post("a", { scheduledAt: sqlTime(Date.now() - 60_000), status: "draft" })];
    for (const type of ["post.approved", "post.changes_requested", "post.failed"]) await send({ type, at: T0 + ++seq });
    await runSchedulerOnce();
    expect(h.publish).not.toHaveBeenCalled();

    due(); // ellenpróba: az ütemező egyébként él
    await runSchedulerOnce();
    expect(h.publish).toHaveBeenCalledTimes(1);
  });

  it("a kiküldés közben érkező post.published után a hibás küldés nem kerül vissza a sorba", async () => {
    due();
    h.publish = vi.fn(async () => {
      expect(thePost().status).toBe("approved");
      expect(await send({ type: "post.published" })).toBe(200);
      throw new Error("503 timeout");
    });
    await runSchedulerOnce();
    expect(thePost().status).toBe("published");
    await runSchedulerOnce();
    expect(h.publish).toHaveBeenCalledTimes(1);
  });

  it("a scheduled_posts sorát semmi nem küldi ki", async () => {
    tables.scheduled_posts = [{ id: "s-1", profileId: "p-a", contentId: "a", status: "pending", scheduledAt: sqlTime(Date.now() - 60_000) }];
    await send({ type: "post.published" });
    await runSchedulerOnce();
    expect(h.publish).not.toHaveBeenCalled();
    expect(log.some((c) => c.sql.includes("scheduled_posts"))).toBe(false);
    for (const file of ["server/scheduler.ts", "server/publishing.ts", "server/socialPublisher.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/scheduledPosts|scheduled_posts/);
    }
  });
});

// ─── Értesítés ───────────────────────────────────────────────────────────────

describe("értesítés", () => {
  it("az aktív felhasználóknak, posztonként és állapotonként egy olvasatlan", async () => {
    await send({ type: "post.changes_requested" });
    expect(rows("app_notifications")).toMatchObject(["u-1", "u-2"].map((appUserId) => ({
      appUserId, profileId: "p-a", type: "system", title: "Módosítást kértek a Social Hubban", actionUrl: "/tartalom-studio?poszt=a", isRead: 0,
    })));
    expect(rows("app_notifications")[0].body).toBe("A „Cím a” posztnál módosítást kértek. A részleteket a Social Hubban látod.");
    await send({ type: "post.changes_requested" }); // ugyanaz a változás másik azonosítóval
    await send({ type: "post.changes_requested", at: T0 + 1000 });
    expect(rows("app_notifications")).toHaveLength(2);
    await send({ type: "post.failed", at: T0 + 2000 });
    expect(rows("app_notifications")).toHaveLength(4);
    // Olvasás után az újabb változás újra értesít, az ismétlés nem.
    rows("app_notifications").forEach((n) => { n.isRead = 1; });
    await send({ type: "post.failed", at: T0 + 2000 });
    expect(rows("app_notifications")).toHaveLength(4);
    await send({ type: "post.failed", at: T0 + 3000 });
    expect(rows("app_notifications")).toHaveLength(6);
  });

  it("elavult esemény, jóváhagyás és megjelenés nem értesít", async () => {
    await send({ type: "post.approved", at: T0 + 10 });
    await send({ type: "post.changes_requested", at: T0 });
    await send({ type: "post.published", at: T0 + 20 });
    await send({ type: "post.failed", at: T0 + 30 });
    expect(rows("app_notifications")).toHaveLength(0);
  });

  it("két azonos című poszt külön értesítést kap", async () => {
    tables.content_posts = [post("a", { title: "Közös" }), post("b", { title: "Közös" })];
    seedSent(post("b"));
    await send({ type: "post.failed" });
    await send({ type: "post.failed", hubPost: "sh-b" });
    expect(rows("app_notifications").map((n) => n.actionUrl)).toEqual(
      ["/tartalom-studio?poszt=a", "/tartalom-studio?poszt=a", "/tartalom-studio?poszt=b", "/tartalom-studio?poszt=b"]);
  });
});

// ─── AI-memória ──────────────────────────────────────────────────────────────

describe("AI-memória", () => {
  const SENT_TEXT = "Küldéskori szöveg a\n\n#teszt";

  it("döntésenként egyszer, a küldéskori szövegből, a közben átírt poszt mellett is", async () => {
    Object.assign(thePost(), { content: "Átírt", pillar: "Más pillér", platform: "facebook", title: "Más" });
    await send({ type: "post.approved", at: T0 + 10 });
    await send({ type: "post.approved", at: T0 + 20 });
    await send({ type: "post.changes_requested", at: T0 }); // elavult, de döntés
    expect(rows("ai_memories")).toMatchObject([
      { profileId: "p-a", memoryType: "approved_pattern", context: "Jóváhagyva a Social Hubban", content: SENT_TEXT, platform: "linkedin", pillar: "Szakértelem" },
      { profileId: "p-a", memoryType: "rejected_pattern", context: "Módosítást kértek a Social Hubban", content: SENT_TEXT, platform: "linkedin", pillar: "Szakértelem" },
    ]);
    expect(rows("social_hub_memory_marks").map((m) => m.decision)).toEqual(["approved", "changes_requested"]);
    await send({ type: "post.published" });
    await send({ type: "post.failed" });
    expect(rows("ai_memories")).toHaveLength(2);
  });

  it("újabb, sikertelen küldés mellett is a sikeres kísérlet szövege számít", async () => {
    const rewritten = buildPostContent(post("a", { content: "Átírt" }) as any);
    if (!rewritten.ok) throw new Error();
    tables.social_hub_send_attempts.push({
      id: "at-uj", profileId: "p-a", socialHubClientId: CLIENT, status: "uncertain", postIds: ["a"], lastTriedAt: sqlTime(T0 + 1),
      body: buildDraftsBody([buildDraft(rewritten.content, ACCOUNT)]),
    });
    Object.assign(theDelivery(), { attemptId: "at-uj", status: "uncertain", contentHash: rewritten.hash });
    await send();
    expect(rows("ai_memories")).toMatchObject([{ content: SENT_TEXT }]);
  });

  it("ha a küldéskori szöveg nem azonosítható, nem íródik memória (a jelenlegi tartalomból soha)", async () => {
    const attempt = tables.social_hub_send_attempts[0];
    const good = { ...attempt };
    for (const broken of [{ status: "uncertain" }, { status: "sending" }, { body: "nem json" }, { body: "null" }, { body: buildDraftsBody([]) },
      { postIds: ["a"] }, { postIds: ["a", "elotte"] }, { profileId: "p-b" }, { socialHubClientId: OTHER_CLIENT }]) {
      Object.assign(attempt, good, broken);
      expect(await send()).toBe(200);
    }
    Object.assign(attempt, good);
    const sentHash = theDelivery().sentHash;
    for (const hash of [null, "0".repeat(64)]) {
      theDelivery().sentHash = hash;
      expect(await send()).toBe(200);
    }
    expect(rows("ai_memories")).toHaveLength(0);
    expect(rows("social_hub_memory_marks")).toHaveLength(0);
    theDelivery().sentHash = sentHash;
    await send();
    expect(rows("ai_memories")).toHaveLength(1);
  });

  it("korlátozott hossz, emoji közepén nem vágva", async () => {
    tables.social_hub_send_attempts = []; tables.social_hub_post_deliveries = [];
    seedSent(post("a", { content: "x".repeat(MAX_MEMORY_LENGTH - 1) + "😀 vége", hashtags: [] }));
    await send();
    expect(rows("ai_memories")[0].content).toBe("x".repeat(MAX_MEMORY_LENGTH - 1));
  });

  it("a tartalom-hash értéke változatlan, és a vázlatból bármely platformmal újraszámolható", () => {
    const full = post("a", { scheduledAt: new Date(T0), imageUrl: "https://kep.hu/a.png", pillar: "Pillér" });
    const built = buildPostContent(full as any);
    if (!built.ok) throw new Error();
    const legacy = createHash("sha256")
      .update(JSON.stringify(["v1", SENT_TEXT, "linkedin", new Date(T0).toISOString(), "https://kep.hu/a.png", "Pillér"])).digest("hex");
    expect(built.hash).toBe(legacy);
    expect(hashDraftContent(buildDraft(built.content, ACCOUNT)!, "linkedin")).toBe(legacy);
    const bare = buildPostContent(post("a", { pillar: null, platform: "tiktok" }) as any);
    if (!bare.ok) throw new Error();
    expect(bare.hash).toBe(createHash("sha256").update(JSON.stringify(["v1", SENT_TEXT, "tiktok", null, null, null])).digest("hex"));
    expect(matchSentDraft({ body: buildDraftsBody([buildDraft(bare.content, ACCOUNT)]), postIds: ["a"] }, "a", bare.hash)?.platform).toBe("tiktok");
  });
});

// ─── Titok ───────────────────────────────────────────────────────────────────

describe("webhook-titok", () => {
  const NEW_SECRET = "whsec_TITKOS-uj-teszt-titok-0987654321";
  const KEY = "sh_live_TITKOS-teszt-kulcs-9876";
  const admin = () => caller("super_admin");
  const connect = (baseUrl = "https://93.184.216.34/api/v1") => admin().connection.save({ baseUrl, apiKey: KEY });
  const secretSet = async () => (await admin().webhook.get()).secretSet;

  it("csak rendszergazda kezelheti", async () => {
    for (const role of ["user", "admin"]) {
      const { webhook } = caller(role);
      for (const work of [() => webhook.get(), () => webhook.saveSecret({ secret: NEW_SECRET }), () => webhook.deleteSecret()]) {
        await expect(work()).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect(writes()).toHaveLength(0);
  });

  it("titkosítva tárolódik, cserélhető, törölhető, és soha nem megy vissza", async () => {
    vi.stubEnv("SOCIAL_HUB_API_URL", "https://hub.test/api/v1"); vi.stubEnv("SOCIAL_HUB_API_KEY", KEY);
    const answers = [await admin().webhook.saveSecret({ secret: ` ${NEW_SECRET} ` }), await admin().webhook.get(), await admin().connection.get()];
    expect(answers[1]).toMatchObject({ available: true, secretSet: true, url: expect.stringMatching(/^https?:\/\/.+\/api\/social-hub\/webhook$/) });
    expect((answers[1] as any).updatedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(answers)).not.toMatch(/whsec_|enc:v1|TITKOS/);
    expect(rows("social_hub_webhook_secret")).toHaveLength(1);
    expect(rows("social_hub_webhook_secret")[0].secretEnc).toMatch(/^enc:v1:/);
    expect(await resolveWebhookSecret()).toBe(NEW_SECRET);
    expect(await deliver(event(), { secret: NEW_SECRET })).toBe(200);
    expect(await deliver(event(), { secret: SECRET })).toBe(401);
    await admin().webhook.deleteSecret();
    expect(await admin().webhook.get()).toMatchObject({ secretSet: false, updatedAt: null });
    expect(await deliver(event(), { secret: NEW_SECRET })).toBe(503);
  });

  it("rossz formátum, hiányzó kapcsolat, titkosítás nélkül: nem menthető, a hiba nem idézi a titkot", async () => {
    const before0 = structuredClone(tables.social_hub_webhook_secret);
    const errors: any[] = [];
    const fail = async (secret: string) => { errors.push(await admin().webhook.saveSecret({ secret }).then(() => null, (e: any) => e)); };
    await fail(NEW_SECRET);
    expect(errors[0]).toMatchObject({ code: "PRECONDITION_FAILED", message: "Előbb kösd be a Social Hubot." });
    vi.stubEnv("SOCIAL_HUB_API_URL", "https://hub.test/api/v1"); vi.stubEnv("SOCIAL_HUB_API_KEY", KEY);
    for (const bad of ["TITKOS-nem-whsec-123456789", "whsec_", "whsec_rovid", "whsec_TITKOS szóköz 123456789"]) await fail(bad);
    expect(errors.slice(1).every((e) => e?.code === "BAD_REQUEST")).toBe(true);
    expect(errors.map((e) => e.message).join()).not.toMatch(/TITKOS/);
    expect(tables.social_hub_webhook_secret).toEqual(before0);

    // JWT_SECRET nélkül (friss modulokkal, mert a kulcs gyorsítótárazott).
    vi.resetModules();
    const { ENV: freshEnv } = await import("./_core/env");
    const saved = freshEnv.cookieSecret;
    (freshEnv as any).cookieSecret = "";
    const fresh = await import("./socialHub/config");
    expect(fresh.encryptApiKey(NEW_SECRET)).toBeNull();
    expect(await fresh.resolveWebhookSecret()).toBeNull();
    (freshEnv as any).cookieSecret = saved;
    vi.resetModules();
  });

  it("bontáskor és címcserénél törlődik ugyanabban a tranzakcióban, kulcscserénél megmarad", async () => {
    await connect();
    expect(await secretSet()).toBe(false); // az ismeretlen eredetű titok nem maradhat
    await admin().webhook.saveSecret({ secret: NEW_SECRET });
    await connect("https://93.184.216.34/api/v1/");
    expect(await secretSet()).toBe(true);
    log = [];
    await connect("https://93.184.216.35/api/v1");
    expect(await secretSet()).toBe(false);
    expect(log.filter((c) => /^delete from `social_hub_webhook_secret`/.test(c.sql))).toMatchObject([{ conn: "tx" }]);
    await admin().webhook.saveSecret({ secret: NEW_SECRET });
    await admin().connection.disconnect();
    expect(await secretSet()).toBe(false);
    expect(rows("social_hub_connection")).toHaveLength(0);
  });

  it("az addig érvényes env-címmel is összeveti", async () => {
    vi.stubEnv("SOCIAL_HUB_API_URL", "https://93.184.216.34/api/v1/"); vi.stubEnv("SOCIAL_HUB_API_KEY", KEY);
    await connect();
    expect(await secretSet()).toBe(true);
    tables.social_hub_connection = [];
    await connect("https://93.184.216.35/api/v1");
    expect(await secretSet()).toBe(false);
  });

  it("hiányzó titoktábla mellett a kapcsolat mentése és bontása működik, más hiba viszont visszagördül", async () => {
    before = missing("social_hub_webhook_secret");
    await connect();
    expect(rows("social_hub_connection")).toHaveLength(1);
    expect(await admin().webhook.get()).toMatchObject({ available: true, secretSet: false });
    await expect(admin().webhook.saveSecret({ secret: NEW_SECRET })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await admin().connection.disconnect();
    expect(rows("social_hub_connection")).toHaveLength(0);

    before = () => {};
    await connect();
    before = (sql) => { if (/^delete from `social_hub_webhook_secret`/.test(sql)) throw Object.assign(new Error("SZIVARGAS"), { code: "ER_LOCK_DEADLOCK" }); };
    await expect(admin().connection.disconnect()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(rows("social_hub_connection")).toHaveLength(1);
  });

  it("a kiírt cím az app nyilvános címe", async () => {
    const original = ENV.appUrl;
    (ENV as any).appUrl = "https://ge.test";
    expect((await admin().webhook.get()).url).toBe("https://ge.test/api/social-hub/webhook");
    (ENV as any).appUrl = original;
  });
});
