/**
 * G2A Growth Engine — Demo / teszt fiók(ok) (belső QA)
 *
 * CÉL: belső teszt-fiókok, amikkel a tulaj a FRISS regisztrációs élményt
 * (üres felület + onboarding) tudja megnézni. Két fiók:
 *   1. admin@growthengine.hu / admin
 *   2. teszt / teszt   (felhasználónév — nem email; a login exact-match, ezért jó)
 *
 * BIZTONSÁG (a „feltörhetetlenség" jegyében):
 *   1. Env-gate: csak akkor léteznek, ha ENABLE_DEMO_ACCOUNT="true". Alapból
 *      KI → a default production config NEM tartalmaz gyenge-jelszavú fiókot.
 *   2. Sima "user" jogkör — SOHA nem super_admin (az emailek nincsenek a
 *      SUPER_ADMIN_EMAILS listán, és a seed explicit "user"-t ír).
 *   3. Reset-on-login: minden belépéskor töröljük a demo profil(ok)at és
 *      nullázzuk az onboardingot → nincs perzisztens adat, nincs felhalmozódás,
 *      és a támadó legfeljebb egy üres homokozót lát.
 *   4. Az ownership-checkek (korábbi audit) miatt más felhasználó adatához
 *      így sem fér hozzá.
 *
 * A gyenge jelszavak ELFOGADHATÓK, mert a fenti 4 réteg egy sandbox-ra
 * korlátozza. Ha nem teszteled, kapcsold ki (ENABLE_DEMO_ACCOUNT törlése).
 */
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { ENV } from "./env";
import { createAppUser, getAppUserByEmail, updateAppUser } from "../authDb";
import { getProfilesByAppUser, deleteProfile } from "../db";

type DemoAccount = { email: string; password: string; name: string };

/** A belső teszt-fiókok. Az `email` mező egyben a login-azonosító (lehet
 *  felhasználónév is, pl. "teszt", mert a login exact-match a mezőre). */
const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "admin@growthengine.hu", password: "admin", name: "Teszt felhasználó" },
  { email: "teszt", password: "teszt", name: "Teszt fiók" },
];

/** Backward-compat: az első (elsődleges) demo email. */
export const DEMO_EMAIL = DEMO_ACCOUNTS[0].email;

/** Igaz, ha a demo mód be van kapcsolva ÉS ez valamelyik demo azonosító. */
export function isDemoEmail(email: string): boolean {
  if (!ENV.enableDemoAccount) return false;
  const e = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((a) => a.email.toLowerCase() === e);
}

/**
 * Induláskor hívjuk. Ha a demo mód be van kapcsolva, létrehozza (vagy
 * frissíti) MINDEN demo fiókot: sima user, aktív, ismert jelszó. Ha KI van
 * kapcsolva, nem csinál semmit (a fiókok nem jönnek létre).
 */
export async function seedDemoAccount(): Promise<void> {
  if (!ENV.enableDemoAccount) return;
  for (const acct of DEMO_ACCOUNTS) {
    try {
      const passwordHash = await bcrypt.hash(acct.password, 12);
      const existing = await getAppUserByEmail(acct.email);
      if (existing) {
        // Garantáljuk, hogy sandbox maradjon: sima user + aktív + ismert jelszó.
        await updateAppUser(existing.id, { passwordHash, role: "user", active: true });
        console.log(`[demo] Demo fiók kész (frissítve): ${acct.email}`);
        continue;
      }
      await createAppUser({
        id: nanoid(),
        email: acct.email,
        passwordHash,
        name: acct.name,
        role: "user",
        onboardingCompleted: false,
        profileId: null,
        active: true,
        subscriptionPlan: "free",
        subscriptionBilling: "monthly",
      });
      console.log(`[demo] Demo fiók létrehozva: ${acct.email}`);
    } catch (err) {
      // Non-fatal: a szerver induljon el akkor is, ha egy seed elhasal.
      console.error(`[demo] seedDemoAccount failed for ${acct.email}:`, err);
    }
  }
}

/**
 * Minden demo-belépéskor hívjuk: törli a demo felhasználó profiljait és
 * nullázza az onboardingot, hogy a következő képernyő a friss regisztrációs
 * élmény legyen (üres felület + onboarding).
 */
export async function resetDemoAccountData(userId: string): Promise<void> {
  try {
    const profiles = await getProfilesByAppUser(userId);
    for (const p of profiles) {
      try { await deleteProfile(p.id); } catch { /* non-fatal, folytatjuk */ }
    }
    await updateAppUser(userId, { onboardingCompleted: false, profileId: null });
  } catch (err) {
    console.error("[demo] resetDemoAccountData failed:", err);
  }
}
