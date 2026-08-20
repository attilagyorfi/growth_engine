/**
 * G2A Growth Engine — Demo / teszt fiók (belső QA)
 *
 * CÉL: egy belső teszt-fiók, amivel a tulaj a FRISS regisztrációs élményt
 * tudja megnézni. Email: admin@growthengine.hu, jelszó: admin.
 *
 * BIZTONSÁG (a 2. kérés — feltörhetetlenség — jegyében):
 *   1. Env-gate: csak akkor létezik, ha ENABLE_DEMO_ACCOUNT="true". Alapból
 *      KI → a default production config NEM tartalmaz gyenge-jelszavú fiókot.
 *   2. Sima "user" jogkör — SOHA nem super_admin (az email nincs a
 *      SUPER_ADMIN_EMAILS listán, és a seed explicit "user"-t ír).
 *   3. Reset-on-login: minden belépéskor töröljük a demo profil(ok)at és
 *      nullázzuk az onboardingot → nincs perzisztens adat, nincs felhalmozódás,
 *      és a támadó legfeljebb egy üres homokozót lát.
 *   4. Az ownership-checkek (korábbi audit) miatt más felhasználó adatához
 *      így sem fér hozzá.
 *
 * A gyenge "admin" jelszó ELFOGADHATÓ, mert a fenti 4 réteg egy sandbox-ra
 * korlátozza. Ha nem teszteled, kapcsold ki (ENABLE_DEMO_ACCOUNT törlése).
 */
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { ENV } from "./env";
import { createAppUser, getAppUserByEmail, updateAppUser } from "../authDb";
import { getProfilesByAppUser, deleteProfile } from "../db";

export const DEMO_EMAIL = "admin@growthengine.hu";
const DEMO_PASSWORD = "admin";
const DEMO_NAME = "Teszt felhasználó";

/** Igaz, ha a demo mód be van kapcsolva ÉS ez a demo email címe. */
export function isDemoEmail(email: string): boolean {
  return ENV.enableDemoAccount && email.trim().toLowerCase() === DEMO_EMAIL;
}

/**
 * Induláskor hívjuk. Ha a demo mód be van kapcsolva, létrehozza (vagy
 * frissíti) a demo fiókot: sima user, aktív, ismert jelszó. Ha KI van
 * kapcsolva, nem csinál semmit (a fiók nem jön létre).
 */
export async function seedDemoAccount(): Promise<void> {
  if (!ENV.enableDemoAccount) return;
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const existing = await getAppUserByEmail(DEMO_EMAIL);
    if (existing) {
      // Garantáljuk, hogy sandbox maradjon: sima user + aktív + ismert jelszó.
      // (Ha valaki kézzel átállította volna, visszakényszerítjük.)
      await updateAppUser(existing.id, { passwordHash, role: "user", active: true });
      console.log(`[demo] Demo fiók kész (frissítve): ${DEMO_EMAIL}`);
      return;
    }
    await createAppUser({
      id: nanoid(),
      email: DEMO_EMAIL,
      passwordHash,
      name: DEMO_NAME,
      role: "user",
      onboardingCompleted: false,
      profileId: null,
      active: true,
      subscriptionPlan: "free",
      subscriptionBilling: "monthly",
    });
    console.log(`[demo] Demo fiók létrehozva: ${DEMO_EMAIL}`);
  } catch (err) {
    // Non-fatal: a szerver induljon el akkor is, ha a seed elhasal.
    console.error("[demo] seedDemoAccount failed:", err);
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
