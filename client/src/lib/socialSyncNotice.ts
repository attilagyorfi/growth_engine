/**
 * A reports.sync közösségi ágának eredménye → rövid, tegező üzenet a Riportok oldalra.
 * Sikeres vagy nem kért szinkronnál nincs üzenet (null).
 */
export type SocialSyncOutcome =
  | { status: "synced"; inserted: number; skippedAccounts: number }
  | { status: "skipped"; reason: "not_requested" | "not_configured" | "no_external_ref" | "no_match" }
  | { status: "failed"; reason: "error"; message: string };

export function socialSyncNotice(social: SocialSyncOutcome | null | undefined): string | null {
  if (!social || social.status === "synced") return null;
  if (social.status === "failed") return "A közösségi adatokat most nem sikerült lekérni a Social Hubból. Próbáld újra később.";
  switch (social.reason) {
    case "not_configured":
      return "A közösségi adatok kimaradtak: a Social Hub-kapcsolat még nincs beállítva.";
    case "no_external_ref":
      return "A közösségi adatok kimaradtak: add meg a profil Social Hub-azonosítóját a Beállítások → Integrációk alatt.";
    case "no_match":
      return "A közösségi adatok kimaradtak: a Social Hubban nincs ilyen azonosítójú ügyfél. Nézd meg, jól írtad-e be.";
    default:
      return null;
  }
}
