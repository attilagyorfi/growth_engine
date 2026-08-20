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
  // Fast path: a session-ben cache-elt profileId egyezés.
  //
  // SECURITY (audit HIGH): ez a fast-path KORÁBBAN megkerülhető volt, mert a
  // `completeOnboarding` ownership-check NÉLKÜL állította be az appUsers.profileId-t
  // → egy user egy IDEGEN profilra mutathatott, és a fast-path átengedte. Ezt a
  // completeOnboarding-ban javítottuk (most assertProfileOwnership-öl előbb), így
  // a session profileId-je BIZONYÍTOTTAN saját profil (vagy null). A fast-path
  // ezért ismét biztonságos, és megspórol egy DB-lekérdezést a gyakori úton.
  if (userProfileId && userProfileId === profileId) return;
  // Slow path: a profile.appUserId-t ellenőrizzük (onboarding alatt, amikor a
  // session-ben még nincs profileId, ez a hiteles ellenőrzés).
  const profile = await getProfileById(profileId);
  if (profile && profile.appUserId === appUserId) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Nincs jogosultsága ehhez a profilhoz" });
}
