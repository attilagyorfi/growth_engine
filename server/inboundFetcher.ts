/**
 * G2A Growth Engine – Inbound Email Fetcher (IMAP + AI klasszifikáció)
 *
 * Az `info@g2amarketing.hu` (vagy bármelyik konfigurált) Gmail / IMAP-fiókhoz
 * csatlakozik, a INBOX UNSEEN leveleit lefetcheli, AI-vel kategorizálja
 * (a meglévő 7 kategóriából), majd az `inbound_emails` táblába menti.
 *
 * Duplikáció-szűrés: minden rekord eltárolja az IMAP `imapUid`-jét (az INBOX-on
 * belüli egyedi azonosító). Második fetch során ezeket kihagyjuk.
 *
 * NEM jelöli SEEN-nek a leveleket az IMAP-on — a user a Gmail-ben még olvasatlan
 * formában látja, mi csak másoljuk az appba. (Ha az app megjelölte, a user
 * már nem találná olvasatlannak — ez ronthatja a workflow-t.)
 *
 * Auto-reply NINCS ebben a modulban — a #6b PR-ben jön (AI suggested reply +
 * jóváhagyás-küldés). Itt csak READ-only fetch + osztályozás.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";
import { getDb, getProfilesByAppUser, getAllProfiles } from "./db";
import { inboundEmails, appUsers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// FONTOS: korlát egy fetch-en, hogy ne tartson a kérés perceken át. Ha a Gmail
// INBOX-ban 1000+ UNSEEN van, az AI-hívások szorítása miatt egy futás 5-10
// perces request-té duzzadna, amit a böngésző / Railway timeout megszakítana.
// A user a következő futáson a maradékot kapja meg. A frontend a result-ban
// jelzi `totalUnseen > inserted+skipped` esetben, hogy van még hátra.
const MAX_UIDS_PER_FETCH = 50;

export type FetchResult = {
  ok: boolean;
  totalUnseen: number;       // hány UNSEEN levél van összesen az INBOX-ban
  fetched: number;           // hány UID-ot a futás során feldolgoztunk (max MAX_UIDS_PER_FETCH)
  inserted: number;          // hány új rekord lett a DB-ben
  skipped: number;           // hány UID-ot kihagytunk (már létezett)
  classificationFailures: number; // hány esetben az AI-hívás nem sikerült (fallback "other")
  error?: string;            // ha a teljes fetch elhasalt
  lastSyncedAt: string;      // ISO timestamp
};

// Az inbound kategóriák egyezzenek az `inbound_emails.category` MySQL enum-mal
// és a UI Inbound.tsx categoryConfig-jával.
const CATEGORIES = [
  "interested",
  "not_interested",
  "question",
  "meeting_request",
  "out_of_office",
  "unsubscribe",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

const HUMAN_LABELS: Record<Category, string> = {
  interested: "Érdeklődő (pozitív visszajelzés)",
  not_interested: "Nem érdekli (visszautasítás)",
  question: "Kérdés (több infót kér)",
  meeting_request: "Meeting kérés (időpont-egyeztetés)",
  out_of_office: "Irodán kívül (auto-reply)",
  unsubscribe: "Leiratkozási kérés",
  other: "Egyéb",
};

/**
 * Visszaadja a clientProfile id-t, amihez a bejövő leveleket csatolni kell.
 * Konfigurálható az `INBOUND_PROFILE_ID` env-vel; ha nincs megadva, az
 * INBOUND_IMAP_USER (jellemzően info@g2amarketing.hu) super_admin saját
 * clientProfile-jait használjuk — a `getProfilesByAppUser` ELSŐ elemét.
 *
 * Élesteszt során kiderült: a korábbi "select any super_admin" approach
 * más super_admin (régi/teszt) profile-jába írta a leveleket, így a UI
 * a tényleges fiókban 0 bejövőt mutatott. Ezért most kifejezetten az
 * IMAP-fiók email címéhez tartozó user-t keressük.
 *
 * Diagnostic log a végén minden esetben, hogy a Railway logból azonnal
 * látszódjon, melyik profileId-t választottuk.
 */
async function resolveInboundProfileId(): Promise<string | null> {
  if (ENV.inboundProfileId) {
    console.log(`[inboundFetcher] resolveInboundProfileId: INBOUND_PROFILE_ID env használva → ${ENV.inboundProfileId}`);
    return ENV.inboundProfileId;
  }
  const db = await getDb();
  if (!db) return null;
  const imapEmail = ENV.inboundImapUser.toLowerCase();
  // PRIMARY: az IMAP-fiók email címéhez tartozó user (ha létezik mint
  // appUser, és super_admin). Ez a "helyes" — a levelek annak a fiók
  // tulajdonosának CRM-jében jelennek meg, aki a Gmail/IMAP-ot is birtokolja.
  let owner = (await db.select().from(appUsers).where(eq(appUsers.email, imapEmail)).limit(1))[0];
  let selectionMode = `email-match (${imapEmail})`;
  // FALLBACK: ha nincs ilyen appUser, BÁRMELYIK super_admin (régi viselkedés).
  if (!owner) {
    owner = (await db.select().from(appUsers).where(eq(appUsers.role, "super_admin" as any)).limit(1))[0];
    selectionMode = `fallback first super_admin (no user found for ${imapEmail})`;
  }
  if (!owner?.id) {
    console.warn(`[inboundFetcher] resolveInboundProfileId: NEM TALÁLT super_admin user-t — a levelek nem mentődnek.`);
    return null;
  }
  let chosenId: string | null = owner.profileId ?? null;
  let chosenSource = "appUsers.profileId (aktív profil)";
  if (!chosenId) {
    const profs = await getProfilesByAppUser(owner.id);
    chosenId = profs[0]?.id ?? null;
    chosenSource = `getProfilesByAppUser[0] (${profs.length} profile találva)`;
  }
  // FINAL FALLBACK: a `clientProfiles.appUserId` gyakran null (régi onboarding
  // wizard nem állította be), és emiatt a getProfilesByAppUser üres listát ad
  // még akkor is, ha a UI láthatja a profilokat (profiles.list super_admin
  // esetén getAllProfiles-t hív). Vegyük az első létező profile-t a DB-ből.
  if (!chosenId) {
    const allProfiles = await getAllProfiles();
    chosenId = allProfiles[0]?.id ?? null;
    chosenSource = `getAllProfiles[0] FALLBACK (${allProfiles.length} profile a DB-ben — clientProfiles.appUserId valószínűleg NULL)`;
  }
  console.log(
    `[inboundFetcher] resolveInboundProfileId: owner=${owner.email} (${owner.id}), ` +
    `mode="${selectionMode}", profileId=${chosenId} (${chosenSource})`,
  );
  return chosenId;
}

/**
 * AI klasszifikáció: a from + subject + body alapján az OpenAI
 * (gpt-4o-mini) választ ad a 7 kategóriából. Hiba esetén "other".
 *
 * A prompt magyar és tényközlő — nincs zsargon, és a Brand Hangtól
 * itt szándékosan eltekintünk, mert ez csak osztályozás (a Brand Hang a
 * #6b reply-generator-nél lesz fontos).
 */
async function classify(from: string, subject: string, body: string): Promise<Category> {
  const truncatedBody = body.slice(0, 2000); // OpenAI input-méret optimalizáció
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Te egy ügyfélszolgálati AI-asszisztens vagy. Adott egy bejövő email; osztályozd az alábbi 7 kategória egyikébe. MINDEN válasz KIZÁRÓLAG JSON formátumban, magyarul.",
        },
        {
          role: "user",
          content: `Email feladó: ${from}\nTárgy: ${subject}\nTartalom:\n${truncatedBody}\n\nKategóriák:\n- interested: pozitív visszajelzés, érdeklődés\n- not_interested: visszautasítás\n- question: konkrét kérdés, információkérés\n- meeting_request: időpont-egyeztetés, hívás vagy találkozó kérése\n- out_of_office: automatikus távolléti üzenet\n- unsubscribe: leiratkozási kérés\n- other: minden egyéb\n\nAdj vissza egy JSON-t: { "category": "..." }`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "inbound_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string", enum: [...CATEGORIES] },
            },
            required: ["category"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    const cat = parsed.category as string;
    if ((CATEGORIES as readonly string[]).includes(cat)) return cat as Category;
    return "other";
  } catch (err) {
    console.warn("[inboundFetcher] AI classify failed, falling back to 'other':", err);
    throw err; // a callerben count-oljuk a failure-t, és "other"-t mentünk
  }
}

/**
 * Ellenőrzi, hogy az adott imapUid már szerepel-e az inbound_emails táblában
 * (per profileId — különböző profilokon lehet ugyanaz az UID, mert az INBOX-uid
 * fióktól függ). Egyszerű exists-query, indexelt mező.
 */
async function uidAlreadyStored(profileId: string, imapUid: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true; // ha nincs DB, hagyjuk ki — ne dupláljunk
  // Drizzle .and(...) nélkül és two-eq-vel egyszerűbb:
  const existing = await db
    .select({ id: inboundEmails.id })
    .from(inboundEmails)
    .where(eq(inboundEmails.imapUid, imapUid))
    .limit(1);
  // Ha bármilyen profile-on már van, kihagyjuk (a UID per INBOX egyedi —
  // ugyanakkor csak egy IMAP-fiókkal dolgozunk most, így ez praktikusan
  // azonos a profile-filterrel).
  void profileId;
  return existing.length > 0;
}

/**
 * Fő belépési pont. Megfontolandó: a Resend rate-limithez hasonlóan az
 * OpenAI hívásokat is throttle-oljuk — 200 ms között, ha sok új levél van.
 */
export async function fetchAndStoreInboundEmails(): Promise<FetchResult> {
  const result: FetchResult = {
    ok: false,
    totalUnseen: 0,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    classificationFailures: 0,
    lastSyncedAt: new Date().toISOString(),
  };

  if (!ENV.inboundImapUser || !ENV.inboundImapPassword) {
    result.error = "INBOUND_IMAP_USER vagy INBOUND_IMAP_PASSWORD nincs beállítva. Kérlek konfiguráld a Railway Variables-ben (Gmail app-password szükséges).";
    return result;
  }

  const profileId = await resolveInboundProfileId();
  if (!profileId) {
    result.error = "Nincs olyan super_admin clientProfile, amihez a bejövő leveleket csatolhatnánk. Hozz létre egy projektet/profilt először.";
    return result;
  }

  const db = await getDb();
  if (!db) {
    result.error = "Az adatbázis nem elérhető.";
    return result;
  }

  const client = new ImapFlow({
    host: ENV.inboundImapHost,
    port: ENV.inboundImapPort,
    secure: ENV.inboundImapPort === 993,
    auth: {
      user: ENV.inboundImapUser,
      pass: ENV.inboundImapPassword,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Csak az olvasatlan (UNSEEN) leveleket fetcheljük. A user a Gmail-ben
      // még mindig látja olvasatlanként (nem jelöljük SEEN-nek).
      // .search() Promise<false | number[]> — `false` jelenti, hogy a szerver
      // nem támogatja a query-t, vagy üres az eredmény.
      const searchResult = await client.search({ seen: false });
      const allUids: number[] = Array.isArray(searchResult) ? searchResult : [];
      result.totalUnseen = allUids.length;
      // A legutolsó (legújabb) MAX_UIDS_PER_FETCH UID-t dolgozzuk fel — a Gmail
      // UID-ok növekvő sorrendben, így .slice(-N) a legfrissebbek.
      const uids = allUids.slice(-MAX_UIDS_PER_FETCH);
      result.fetched = uids.length;
      if (uids.length === 0) {
        result.ok = true;
        return result;
      }

      // Először kiszűrjük az UID-eket, amik már a DB-ben vannak (egyenként db hit
      // sokkal gyorsabb mintha minden levelet letöltenénk és aztán dobnánk el).
      const newUids: number[] = [];
      for (const uid of uids) {
        if (await uidAlreadyStored(profileId, String(uid))) {
          result.skipped++;
        } else {
          newUids.push(uid);
        }
      }

      if (newUids.length === 0) {
        // Minden UID már a DB-ben van — különös az első futáson, jelezzük.
        console.log(`[inboundFetcher] Mind a ${result.skipped} UID már a DB-ben — nincs új fetch.`);
        result.ok = true;
        return result;
      }

      // FETCH iterator: egyetlen IMAP körkérés az új UID-ekre. Megbízhatóbb,
      // mint a fetchOne hívások egyenként (kapcsolat-overhead, timeout, stb.).
      // markAsSeen: false → NEM markeli a leveleket SEEN-re, a user a Gmail-ben
      // / webmailben továbbra is olvasatlanként látja.
      let processed = 0;
      for await (const msg of client.fetch(
        newUids,
        { source: true, envelope: true },
        { uid: true },
      )) {
        const imapUid = String(msg.uid);
        const source = msg.source as Buffer | undefined;
        if (!source) {
          result.skipped++;
          console.warn(`[inboundFetcher] UID ${imapUid} — nincs source a fetch eredményben.`);
          continue;
        }
        const parsed = await simpleParser(source);
        const fromAddr = parsed.from?.value?.[0];
        const fromEmail = fromAddr?.address ?? "(ismeretlen)";
        const fromName = fromAddr?.name ?? null;
        const subject = (parsed.subject ?? "(tárgy nélkül)").slice(0, 500);
        const bodyText = (parsed.text ?? parsed.html ?? "").toString();
        processed++;

        // AI klasszifikáció — fallback "other" ha az AI hibázik.
        let category: Category = "other";
        try {
          category = await classify(fromEmail, subject, bodyText);
        } catch {
          result.classificationFailures++;
        }

        try {
          await db.insert(inboundEmails).values({
            id: nanoid(),
            profileId,
            from: fromEmail,
            fromName,
            company: null,
            subject,
            body: bodyText.slice(0, 65000), // text(65535) MySQL limit
            category,
            read: false,
            imapUid,
          });
          result.inserted++;
          console.log(`[inboundFetcher] + ${fromEmail} | ${HUMAN_LABELS[category]} | "${subject.slice(0, 60)}"`);
        } catch (err) {
          console.error(`[inboundFetcher] insert failed for UID ${imapUid}:`, err);
          // ne dobjuk tovább — folytassuk a többi levéllel
        }
      }

      console.log(
        `[inboundFetcher] Szinkron kész — totalUnseen=${result.totalUnseen}, batch=${result.fetched}, ` +
        `már megvolt=${result.skipped - (newUids.length - processed)}, fetch-elt=${processed}, ` +
        `beszúrva=${result.inserted}, AI-hibák=${result.classificationFailures}`,
      );
      result.ok = true;
      return result;
    } finally {
      lock.release();
    }
  } catch (err: any) {
    // ImapFlow error diagnosztika — a `err.message` gyakran csak "Command failed",
    // amiből semmit nem lehet kihámozni. Az igazi részletek a `responseText`,
    // `authenticationFailed`, `code` mezőkben vannak.
    const rawMsg = err?.message ?? "Ismeretlen IMAP hiba.";
    let diagnostic: string;
    if (err?.authenticationFailed === true) {
      diagnostic = `IMAP autentikáció elutasítva (${ENV.inboundImapUser}). Lehetséges okok: (1) a jelszó NEM Gmail APP-PASSWORD (16 karakter, szóközök nélkül) — generálás: https://myaccount.google.com/apppasswords ; (2) a Gmail-ben az IMAP nincs bekapcsolva — Gmail Settings → Forwarding and POP/IMAP → "Enable IMAP" ; (3) a 2FA nincs bekapcsolva a fiókon, így app-password sem generálható. Eredeti üzenet: ${err.responseText || rawMsg}`;
    } else if (err?.code === "ENOTFOUND") {
      diagnostic = `Az IMAP host nem található: ${ENV.inboundImapHost}. Ellenőrizd az INBOUND_IMAP_HOST env-et.`;
    } else if (err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT") {
      diagnostic = `IMAP kapcsolódás elutasítva vagy timeout (${ENV.inboundImapHost}:${ENV.inboundImapPort}). Ellenőrizd a host+port-ot.`;
    } else if (err?.responseText) {
      diagnostic = `IMAP szerver hiba: ${err.responseText} (kód: ${err.responseStatus || "?"})`;
    } else {
      diagnostic = rawMsg;
    }
    result.error = diagnostic;
    console.error("[inboundFetcher] IMAP fetch failed:", {
      message: rawMsg,
      authenticationFailed: err?.authenticationFailed,
      code: err?.code,
      responseText: err?.responseText,
      responseStatus: err?.responseStatus,
    });
    return result;
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

/**
 * Light-súlyú állapot-lekérdezés a Settings panelhez. Nem csatlakozik az
 * IMAP-hoz — csak az env beállítást nézi.
 */
export function getInboundImapStatus(): {
  configured: boolean;
  host: string;
  user: string;
} {
  return {
    configured: !!(ENV.inboundImapUser && ENV.inboundImapPassword),
    host: ENV.inboundImapHost,
    user: ENV.inboundImapUser ? ENV.inboundImapUser : "",
  };
}
