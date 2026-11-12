/**
 * G1 – márkák (alárkák) a DB-rétegben: márkánkénti csere, szűrés, kapcsolat
 * márkaváltása, márkatörlés, Social Hub-azonosító ütközése.
 *
 * Valódi adatbázis nélkül: a mysql2-pool és a drizzle() egy felvevő hamis DB-re
 * cserélődik, a WHERE-feltételeket a drizzle MySQL-dialektusa SQL-lé rendereli,
 * így a valódi helperek valódi szűrőit ellenőrizzük. A dupla számolás hiányát egy
 * memóriabeli tárral, a syncProfileMetrics-en keresztül igazoljuk.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

type Op = { op: string; table?: unknown; where?: { sql: string; params: unknown[] } | null; set?: any; values?: any };
const h = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://teszt@localhost/teszt";
  return { ops: [] as Op[], selectResults: [] as unknown[][], fakeDb: null as any };
});

vi.mock("mysql2/promise", () => ({ default: { createPool: () => ({ query: async () => [] }) } }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => h.fakeDb }));

const dialect = new MySqlDialect();
function chain(op: Op) {
  const c: any = {
    from: (t: unknown) => { op.table = t; return c; },
    where: (w: any) => { op.where = w ? dialect.sqlToQuery(w) : null; return c; },
    set: (v: unknown) => { op.set = v; return c; },
    values: (v: unknown) => { op.values = v; return c; },
    limit: () => c,
    orderBy: () => c,
    then: (res: any, rej: any) => {
      h.ops.push(op);
      return Promise.resolve(op.op === "select" ? (h.selectResults.shift() ?? []) : undefined).then(res, rej);
    },
  };
  return c;
}
h.fakeDb = {
  select: () => chain({ op: "select" }),
  delete: (table: unknown) => chain({ op: "delete", table }),
  update: (table: unknown) => chain({ op: "update", table }),
  insert: (table: unknown) => chain({ op: "insert", table }),
  transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    h.ops.push({ op: "begin" });
    const r = await cb(h.fakeDb);
    h.ops.push({ op: "commit" });
    return r;
  },
};

import {
  replaceReportMetrics,
  replaceSocialReportMetrics,
  getMetricsByProfile,
  planConnectionBrandChange,
  setDataConnectionBrand,
  deleteProfileBrand,
  createProfileBrand,
  updateProfileBrand,
  setProfileExternalRef,
  PROFILE_OWNED_TABLES,
} from "./db";
import { dataConnections, profileBrands, reportMetrics, clientProfiles } from "../drizzle/schema";
import { syncProfileMetrics, type SyncProfileDeps } from "./reports/syncProfile";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (platform: any, value: number) => ({ platform, date: d("2026-10-05"), metricKey: "clicks", value, currency: null, dimension: null });
const opsOf = (op: string, table?: unknown) => h.ops.filter((o) => o.op === op && (table === undefined || o.table === table));

beforeEach(() => {
  h.ops.length = 0;
  h.selectResults.length = 0;
});

describe("márkánkénti csere (replaceReportMetrics / replaceSocialReportMetrics)", () => {
  it("az A márka újraírása csak az A márka sorait törli (B és a márka nélküli marad), a sorok A-t kapják", async () => {
    await replaceReportMetrics("p-1", "google_ads", "2026-10-01", "2026-10-31", [row("google_ads", 3)], undefined, "brand-a");
    const del = opsOf("delete", reportMetrics)[0].where!;
    expect(del.sql).toMatch(/`report_metrics`\.`brandId` = \?/);
    expect(del.sql).not.toMatch(/is null/i);
    expect(del.params).toContain("brand-a");
    expect(del.params).not.toContain("brand-b");
    expect(del.params).toEqual(expect.arrayContaining(["p-1", "google_ads"]));
    expect(opsOf("insert", reportMetrics)[0].values[0]).toMatchObject({ profileId: "p-1", brandId: "brand-a", value: 3 });
  });

  it("a márka nélküli (NULL) írás csak a NULL sorokat törli, a márkásakat nem", async () => {
    await replaceReportMetrics("p-1", "google_ads", "2026-10-01", "2026-10-31", [row("google_ads", 1)]);
    const del = opsOf("delete", reportMetrics)[0].where!;
    expect(del.sql).toMatch(/`report_metrics`\.`brandId` is null/i);
    expect(del.params).not.toContain("brand-a");
    expect(opsOf("insert", reportMetrics)[0].values[0].brandId).toBeNull();
  });

  it("a közösségi csere is márkánként szűr", async () => {
    await replaceSocialReportMetrics("p-1", "2026-10-01", "2026-10-31", [row("facebook", 5)], undefined, "brand-b");
    const del = opsOf("delete", reportMetrics)[0].where!;
    expect(del.sql).toMatch(/`brandId` = \?/);
    expect(del.params).toContain("brand-b");
    expect(opsOf("insert", reportMetrics)[0].values[0].brandId).toBe("brand-b");

    h.ops.length = 0;
    await replaceSocialReportMetrics("p-1", "2026-10-01", "2026-10-31", []);
    expect(opsOf("delete", reportMetrics)[0].where!.sql).toMatch(/`brandId` is null/i);
  });
});

describe("getMetricsByProfile márkaszűrővel", () => {
  it("brandId-val csak az adott márka sorai, nélküle (összesítve) nincs márkaszűrő", async () => {
    await getMetricsByProfile("p-1", "2026-10-01", "2026-10-31", "brand-a");
    const withBrand = opsOf("select")[0].where!;
    expect(withBrand.sql).toMatch(/`brandId` = \?/);
    expect(withBrand.params).toContain("brand-a");

    for (const none of [undefined, null]) {
      h.ops.length = 0;
      await getMetricsByProfile("p-1", "2026-10-01", "2026-10-31", none);
      expect(opsOf("select")[0].where!.sql).not.toMatch(/brandId/);
    }
  });
});

describe("kapcsolat márkaváltása", () => {
  const conns = [
    { id: "c-1", platform: "google_ads" as const, brandId: "brand-a" },
    { id: "c-2", platform: "ga4" as const, brandId: "brand-a" },
  ];

  it("planConnectionBrandChange: átcímkéz, ha egyedül volt a régi címkén; töröl, ha nem; semmi, ha nem vált", () => {
    expect(planConnectionBrandChange(conns, "c-1", "brand-b")).toEqual({ action: "relabel", platform: "google_ads", fromBrandId: "brand-a", toBrandId: "brand-b" });
    expect(planConnectionBrandChange(conns, "c-1", null)).toMatchObject({ action: "relabel", toBrandId: null });
    const shared = [...conns, { id: "c-3", platform: "google_ads" as const, brandId: "brand-a" }];
    expect(planConnectionBrandChange(shared, "c-1", "brand-b")).toMatchObject({ action: "delete", fromBrandId: "brand-a" });
    expect(planConnectionBrandChange(conns, "c-1", "brand-a")).toEqual({ action: "none" });
    expect(planConnectionBrandChange(conns, "nincs", "brand-a")).toEqual({ action: "none" });
  });

  it("setDataConnectionBrand: egy tranzakcióban a kapcsolat és a régi címkés sorok átcímkézése", async () => {
    h.selectResults.push(conns);
    const res = await setDataConnectionBrand("p-1", "c-1", "brand-b");
    expect(res).toMatchObject({ ok: true, plan: { action: "relabel" } });
    expect(h.ops.map((o) => o.op)).toEqual(["begin", "select", "update", "update", "commit"]);
    expect(opsOf("update", dataConnections)[0].set).toEqual({ brandId: "brand-b" });
    const relabel = opsOf("update", reportMetrics)[0];
    expect(relabel.set).toEqual({ brandId: "brand-b" });
    expect(relabel.where!.params).toEqual(expect.arrayContaining(["p-1", "google_ads", "brand-a"]));
  });

  it("setDataConnectionBrand: márka nélkülre váltásnál a régi márkás sorok NULL-t kapnak; közös címkénél törlés", async () => {
    h.selectResults.push(conns);
    await setDataConnectionBrand("p-1", "c-1", null);
    expect(opsOf("update", reportMetrics)[0].set).toEqual({ brandId: null });

    h.ops.length = 0;
    h.selectResults.push([{ id: "c-1", platform: "google_ads", brandId: null }, { id: "c-9", platform: "google_ads", brandId: null }]);
    await setDataConnectionBrand("p-1", "c-1", "brand-a");
    const del = opsOf("delete", reportMetrics)[0].where!;
    expect(del.sql).toMatch(/`brandId` is null/i);
    expect(opsOf("update", reportMetrics)).toHaveLength(0);
  });

  it("idegen / nem létező kapcsolatnál not_found, írás nélkül", async () => {
    h.selectResults.push(conns);
    expect(await setDataConnectionBrand("p-1", "mas-profil-kapcsolata", "brand-a")).toEqual({ ok: false, reason: "not_found" });
    expect(opsOf("update")).toHaveLength(0);
  });

  it("váltás (A→B) és újraszinkron után az összesítés nem számol kétszer", async () => {
    // Memóriabeli report_metrics a valódi csere-hatókörrel (profil + platform + márka + időszak).
    type Stored = { profileId: string; platform: string; brandId: string | null; value: number };
    let store: Stored[] = [];
    const connections = [{ id: "c-1", profileId: "p-1", platform: "google_ads", brandId: "brand-a" as string | null }];
    const deps: SyncProfileDeps = {
      listConnections: async () => connections as any,
      fetchMetrics: async () => [row("google_ads", 10)] as any,
      replaceRows: async (profileId, platform, _from, _to, rows, brandId = null) => {
        store = store.filter((r) => !(r.profileId === profileId && r.platform === platform && r.brandId === brandId));
        store.push(...rows.map((r) => ({ profileId, platform, brandId, value: r.value })));
        return { inserted: rows.length };
      },
      getProfile: async () => ({ externalRef: null }),
      syncSocial: async () => ({ status: "skipped", reason: "no_external_ref" }),
    };
    const total = () => store.reduce((a, r) => a + r.value, 0);

    await syncProfileMetrics("p-1", "2026-10-01", "2026-10-31", undefined, deps);
    expect(total()).toBe(10);

    // A márkaváltás: a terv szerinti átcímkézés a tárban, majd újraszinkron.
    const plan = planConnectionBrandChange(connections as any, "c-1", "brand-b");
    if (plan.action === "relabel") store.forEach((r) => { if (r.platform === plan.platform && r.brandId === plan.fromBrandId) r.brandId = plan.toBrandId; });
    connections[0].brandId = "brand-b";
    await syncProfileMetrics("p-1", "2026-10-01", "2026-10-31", undefined, deps);
    expect(total()).toBe(10);
    expect(store.every((r) => r.brandId === "brand-b")).toBe(true);

    // B → nincs márka, újraszinkron: továbbra is egyszer számol.
    const plan2 = planConnectionBrandChange(connections as any, "c-1", null);
    if (plan2.action === "relabel") store.forEach((r) => { if (r.brandId === plan2.fromBrandId) r.brandId = plan2.toBrandId; });
    connections[0].brandId = null;
    await syncProfileMetrics("p-1", "2026-10-01", "2026-10-31", undefined, deps);
    expect(total()).toBe(10);
  });
});

describe("márka törlése (deleteProfileBrand)", () => {
  it("hozzárendelt kapcsolatnál has_connections, törlés nélkül", async () => {
    h.selectResults.push([{ id: "brand-a" }], [{ id: "c-1" }]);
    expect(await deleteProfileBrand("p-1", "brand-a")).toEqual({ ok: false, reason: "has_connections" });
    expect(opsOf("delete")).toHaveLength(0);
  });

  it("kapcsolat nélkül egy tranzakcióban törli a márka metrikasorait és a márkát (a riportokat nem)", async () => {
    h.selectResults.push([{ id: "brand-a" }], []);
    expect(await deleteProfileBrand("p-1", "brand-a")).toEqual({ ok: true });
    expect(h.ops.map((o) => o.op)).toEqual(["begin", "select", "select", "delete", "delete", "commit"]);
    const [metricsDel, brandDel] = opsOf("delete");
    expect(metricsDel.table).toBe(reportMetrics);
    expect(metricsDel.where!.params).toEqual(["p-1", "brand-a"]);
    expect(brandDel.table).toBe(profileBrands);
  });

  it("más profil márkájánál not_found", async () => {
    h.selectResults.push([]);
    expect(await deleteProfileBrand("p-1", "mas-markaja")).toEqual({ ok: false, reason: "not_found" });
    expect(opsOf("delete")).toHaveLength(0);
  });
});

describe("Social Hub-azonosító ütközése (márka ↔ profil)", () => {
  it("márka: ha egy profil már használja, ref_taken, mentés nélkül", async () => {
    // név-ütközés: nincs; márka-ref: nincs; profil-ref: van.
    h.selectResults.push([], [], [{ id: "masik-profil" }]);
    expect(await createProfileBrand("p-1", { name: "Chery", socialHubExternalRef: "steba" })).toEqual({ ok: false, reason: "ref_taken" });
    expect(opsOf("insert")).toHaveLength(0);
    expect(opsOf("select").at(-1)!.table).toBe(clientProfiles);
  });

  it("márka: ha másik márka használja, ref_taken; azonos név a profilon belül: name_taken", async () => {
    h.selectResults.push([], [{ id: "masik-marka" }]);
    expect(await createProfileBrand("p-1", { name: "Chery", socialHubExternalRef: "chery" })).toEqual({ ok: false, reason: "ref_taken" });
    h.selectResults.push([{ id: "brand-x" }]);
    expect(await createProfileBrand("p-1", { name: "Nissan", socialHubExternalRef: null })).toEqual({ ok: false, reason: "name_taken" });
    expect(opsOf("insert")).toHaveLength(0);
  });

  it("márka frissítése: a saját azonosítója nem ütközik önmagával", async () => {
    // getProfileBrand → van; márka-ref (önmaga kizárva) → nincs; profil-ref → nincs; update; getProfileBrand.
    const brand = { id: "brand-a", profileId: "p-1", name: "Nissan", socialHubExternalRef: "nissan" };
    h.selectResults.push([brand], [], [], [brand]);
    expect(await updateProfileBrand("p-1", "brand-a", { socialHubExternalRef: "nissan" })).toEqual({ ok: true, brand });
    const refCheck = opsOf("select")[1];
    expect(refCheck.where!.sql).toMatch(/<>/);
    expect(refCheck.where!.params).toEqual(["nissan", "brand-a"]);
  });

  it("profil (fordítva): ha egy márka már használja, taken, mentés nélkül", async () => {
    h.selectResults.push([{ id: "brand-a" }]);
    expect(await setProfileExternalRef("p-2", "nissan")).toEqual({ ok: false, reason: "taken" });
    expect(opsOf("update")).toHaveLength(0);
    // Márka nélküli azonosítónál a mentés lefut.
    h.selectResults.push([]);
    expect(await setProfileExternalRef("p-2", "szabad")).toEqual({ ok: true });
    expect(opsOf("update", clientProfiles)).toHaveLength(1);
  });
});

it("a profil törlése a márkáit is törli", () => {
  expect(PROFILE_OWNED_TABLES).toContain("profileBrands");
});
