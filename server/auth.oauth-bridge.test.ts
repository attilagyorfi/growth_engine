/**
 * OAuth Bridge Test
 * Verifies that a Manus OAuth user automatically gets an appUser record
 * and that the g2amarketing admin email gets super_admin role.
 *
 * NOTE: ezek INTEGRÁCIÓS tesztek — valódi DATABASE_URL-t igényelnek,
 * mert közvetlenül írnak a appUsers táblába a getOrCreateAppUserFromOAuth-on
 * keresztül. Lokális dev környezetben (DB nélkül) skip-elődnek; CI-ben
 * vagy egy testcontainer-es runben futnak le.
 *
 * A skip a `describe.skipIf` vitest helper-rel történik, így a futtatás
 * automatikus a DATABASE_URL jelenlététől függően. Egy mock-os refaktor
 * (authDb.ts-be DB instance injektálás) későbbi PR-be kerülhet, ha
 * unit-tesztelni szeretnénk a logikát DB nélkül.
 */
import { describe, expect, it } from "vitest";
import { getOrCreateAppUserFromOAuth } from "./authDb";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)("OAuth Bridge – getOrCreateAppUserFromOAuth (integration)", () => {
  const testEmail = `oauth-bridge-test-${Date.now()}@test.example.com`;

  it("creates a new appUser for an unknown OAuth user", async () => {
    const result = await getOrCreateAppUserFromOAuth({
      email: testEmail,
      name: "Test OAuth User",
      openId: "test-open-id-123",
    });
    expect(result).not.toBeNull();
    expect(result?.email).toBe(testEmail);
    expect(result?.role).toBe("user");
    expect(result?.active).toBe(true);
    expect(result?.onboardingCompleted).toBe(false);
  }, 15_000);

  it("returns the existing appUser on second call (idempotent)", async () => {
    const first = await getOrCreateAppUserFromOAuth({
      email: testEmail,
      name: "Test OAuth User",
      openId: "test-open-id-123",
    });
    const second = await getOrCreateAppUserFromOAuth({
      email: testEmail,
      name: "Test OAuth User",
      openId: "test-open-id-123",
    });
    expect(first?.id).toBe(second?.id);
  });

  it("assigns super_admin role to the g2amarketing admin email", async () => {
    const result = await getOrCreateAppUserFromOAuth({
      email: "info@g2amarketing.hu",
      name: "G2A Admin",
      openId: "g2a-admin-open-id",
    });
    // Should find the existing super_admin user (created earlier)
    expect(result).not.toBeNull();
    expect(result?.role).toBe("super_admin");
  });
});
