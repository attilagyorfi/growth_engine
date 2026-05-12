/**
 * G2A Growth Engine – Profile ownership helper
 *
 * Centralizált ellenőrzés: egy adott profileId a jelenleg bejelentkezett
 * appUser-hez tartozik-e (vagy super_admin az illető).
 *
 * Fast path: az appUser-en cache-elt profileId egyezés (legtöbb hívás).
 * Slow path: DB lookup a profile.appUserId mezőjén (onboarding közben
 * előfordul, hogy a session-ben még nincs profileId).
 */
import { TRPCError } from "@trpc/server";
import { getProfileById } from "../db";

export async function assertProfileOwnership(
  appUserId: string,
  role: string,
  profileId: string,
  userProfileId: string | null,
): Promise<void> {
  if (role === "super_admin") return; // super admin can access any profile
  if (userProfileId && userProfileId === profileId) return; // fast path
  // Slow path: a profile.appUserId-t ellenőrizzük (onboarding alatt is megy)
  const profile = await getProfileById(profileId);
  if (profile && profile.appUserId === appUserId) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Nincs jogosultsága ehhez a profilhoz" });
}
