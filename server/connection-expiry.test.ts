/**
 * Social kapcsolatok lejárati figyelmeztetése — adatbázis nélkül.
 * A LinkedIn-hozzáférés 60 napig él, frissítés nélkül: 7 nappal előtte és lejáratkor
 * kapcsolatonként egyszer értesítünk.
 */
import { describe, it, expect, vi } from "vitest";
import { expiryNotice, runExpiryCheck, type ExpiringConnection, type ExpiryDeps } from "./connectionExpiry";
import { connectionHealth, needsReconnect } from "../client/src/lib/connectionHealth";

const now = new Date("2026-12-08T10:00:00Z");
const conn = (expires: string | null, over: Partial<ExpiringConnection> = {}): ExpiringConnection => ({
  id: "c1", profileId: "prof", platform: "linkedin", platformUsername: "Attila Győrfi", tokenExpiresAt: expires, ...over,
});

describe("expiryNotice", () => {
  it("7 napon belül: „Hamarosan lejár …” a dátummal és a hátralévő napokkal", () => {
    const n = expiryNotice(conn("2026-12-13T10:19:55.322Z"), now)!;
    expect(n.title).toBe("Hamarosan lejár a LinkedIn-kapcsolat (2026. 12. 13.)");
    expect(n.body).toMatch(/LinkedIn-fiókod \(Attila Győrfi\) kapcsolata 6 nap múlva/);
    expect(n.body).toMatch(/Beállítások → Integrációk/);
  });

  it("lejárt: „Lejárt …”", () => {
    const n = expiryNotice(conn("2026-12-01T00:00:00Z"), now)!;
    expect(n.title).toBe("Lejárt a LinkedIn-kapcsolat (2026. 12. 01.)");
    expect(n.body).toMatch(/ütemezett posztok nem mennek ki/);
  });

  it("7 napnál messzebb, hiányzó vagy hibás dátum → nincs értesítés", () => {
    expect(expiryNotice(conn("2027-01-30T00:00:00Z"), now)).toBeNull();
    expect(expiryNotice(conn(null), now)).toBeNull();
    expect(expiryNotice(conn("nem-dátum"), now)).toBeNull();
  });
});

describe("runExpiryCheck", () => {
  function deps(conns: ExpiringConnection[], already: string[] = []) {
    const d = {
      now: () => now,
      listActiveConnections: vi.fn(async () => conns),
      hasNotification: vi.fn(async (_p: string, title: string) => already.includes(title)),
      notify: vi.fn(async () => {}),
    };
    return d as typeof d & ExpiryDeps;
  }

  it("csak a lejáró/lejárt kapcsolatokról értesít", async () => {
    const d = deps([conn("2026-12-13T10:19:55Z"), conn("2027-03-01T00:00:00Z", { id: "c2" }), conn("2026-12-01T00:00:00Z", { id: "c3", platform: "facebook", platformUsername: null })]);
    expect(await runExpiryCheck(d)).toEqual({ notified: 2 });
    expect(d.notify).toHaveBeenCalledWith("prof", "Hamarosan lejár a LinkedIn-kapcsolat (2026. 12. 13.)", expect.any(String));
    expect(d.notify).toHaveBeenCalledWith("prof", "Lejárt a Facebook-kapcsolat (2026. 12. 01.)", expect.stringContaining("A(z) Facebook-fiókod kapcsolata"));
  });

  it("ugyanarról a lejáratról nem értesít kétszer (óránkénti futás)", async () => {
    const d = deps([conn("2026-12-13T10:19:55Z")], ["Hamarosan lejár a LinkedIn-kapcsolat (2026. 12. 13.)"]);
    expect(await runExpiryCheck(d)).toEqual({ notified: 0 });
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("újracsatlakozás után (új lejárati dátum) újra értesíthet majd a következő ciklusban", async () => {
    const d = deps([conn("2027-02-11T10:00:00Z")], ["Hamarosan lejár a LinkedIn-kapcsolat (2026. 12. 13.)"]);
    const later = { ...d, now: () => new Date("2027-02-06T10:00:00Z") };
    expect(await runExpiryCheck(later)).toEqual({ notified: 1 });
  });
});

describe("connectionHealth (felület)", () => {
  it("ugyanaz a 7 napos küszöb, mint a szerveren", () => {
    expect(connectionHealth("2026-12-13T10:19:55Z", now)).toMatchObject({ state: "expiring", daysLeft: 6 });
    expect(connectionHealth("2026-12-01T00:00:00Z", now).state).toBe("expired");
    expect(connectionHealth("2027-03-01T00:00:00Z", now).state).toBe("ok");
    expect(connectionHealth(null, now).state).toBe("unknown");
    expect(needsReconnect("2026-12-13T10:19:55Z", now)).toBe(true);
    expect(needsReconnect("2027-03-01T00:00:00Z", now)).toBe(false);
  });
});
