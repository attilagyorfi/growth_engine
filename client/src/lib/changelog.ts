/**
 * G2A Growth Engine — Changelog adatforrás
 *
 * A `client/src/components/ChangelogDrawer.tsx` ezt olvassa be a "Újdonságok"
 * drawer-hez. Új entry-t manuálisan itt kell hozzáadni minden nagyobb PR után.
 *
 * FORMÁTUM:
 * - `id`: egyedi kulcs (nem változtatandó egy entry publikálása után —
 *   az "utolsó megnyitás" logika ehhez viszonyít a badge megjelenítéséhez)
 * - `date`: YYYY-MM-DD (ISO), a legfrissebb kerül felülre a rendezéskor
 * - `category`: "feature" (új funkció) · "improvement" (meglévő javítása) ·
 *   "security" (biztonsági fix) · "fix" (bug fix)
 * - `title`: rövid, magyar (max ~60 char)
 * - `description`: 1-3 mondat, mit ad a userednek (nem technikai jargon)
 * - `href`: opcionális belső link ahova a user ugorhat (pl. új menü)
 *
 * Új entry hozzáadásához: PR merge után írj be egy új objektumot A TÖMB
 * ELEJÉRE (a lista dátum szerinti csökkenő).
 */

export type ChangelogCategory = "feature" | "improvement" | "security" | "fix";

export interface ChangelogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  category: ChangelogCategory;
  title: string;
  description: string;
  href?: string;
}

// Legfrissebb elöl. A user "Újdonságok" drawer-je ebben a sorrendben mutatja.
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-08-notification-center",
    date: "2026-08-13",
    category: "feature",
    title: "Értesítés-központ dedikált oldal",
    description: "A bell ikon dropdown-ja mellett most van egy teljes '/ertesitesek' oldal is: dátumcsoportosítás (Ma / Tegnap / Ezen a héten), típus-szűrő és 'mind olvasottnak jelöl' gomb.",
    href: "/ertesitesek",
  },
  {
    id: "2026-08-pricing-matrix",
    date: "2026-08-13",
    category: "improvement",
    title: "Részletes csomag-összehasonlító tábla",
    description: "A Landing pricing szekció alján egy 20+ funkciós összehasonlító tábla a 4 csomaghoz — most egy pillantással látod, melyik csomag felel meg a legjobban.",
  },
  {
    id: "2026-08-onboarding-checklist",
    date: "2026-08-13",
    category: "feature",
    title: "Első lépések a Dashboardon",
    description: "Új Dashboard-widget: 5 lépés a teljes profilhoz (Brand · Social · Intelligence · Stratégia · Első poszt). Progress bar-ral és 1-kattintós ugrással a soron következő feladatra.",
  },
  {
    id: "2026-08-quick-wins",
    date: "2026-08-12",
    category: "improvement",
    title: "UI polírozás: 404 + Breadcrumb + Toast retry",
    description: "Új, informatív 404 oldal kontextuális gyorslinkekkel. Breadcrumb navigáció a Beállítások tabjai fölött. AI-hiba esetén 'Újra' gomb a toast-ban — 1 kattintás újrapróbálkozás.",
  },
  {
    id: "2026-08-skeleton-loading",
    date: "2026-08-12",
    category: "improvement",
    title: "Skeleton loading — 4 fő oldalon",
    description: "Spinner helyett a valós tartalom-alakú placeholder-ek (Campaigns, Projektek, Hírlevél, Intelligence). Percepciós sebességnyereség 20-30%.",
  },
  {
    id: "2026-08-command-palette",
    date: "2026-08-12",
    category: "feature",
    title: "Cmd+K parancspaletta",
    description: "Nyisd meg Cmd+K (Mac) vagy Ctrl+K (Windows) gombbal — 9 menü + projektváltó + gyors AI-parancsok mind egy palettán. Super admin projektváltás 1 másodperc alatt.",
  },
  {
    id: "2026-08-empty-states",
    date: "2026-08-12",
    category: "improvement",
    title: "Barátságos üres állapotok",
    description: "A Hírlevél / Projektek / SEO Audit oldalak üres nézete most magyarázó leírással és 1-kattintós akció-gombbal jön.",
  },
  {
    id: "2026-08-auth-token-migration",
    date: "2026-08-11",
    category: "improvement",
    title: "Bejelentkezés-oldalak konzisztens dizájnja",
    description: "A Login / Register / Elfelejtett-jelszó / Reset oldalak most vizuálisan összhangban vannak a Dashboarddal.",
  },
  {
    id: "2026-08-reports-generator",
    date: "2026-08-07",
    category: "feature",
    title: "Riportgenerátor modul (béta)",
    description: "Új menüpont Pro csomagtól: havi PDF-riport a Google Ads / GA4 / Search Console / Meta Ads teljesítményről, AI vezetői összefoglalóval. Jelenleg mock adattal — a valós API-integrációk a Google OAuth és Meta Ads Review lezárása után élnek.",
    href: "/riportok",
  },
  {
    id: "2026-06-social-oauth",
    date: "2026-06-24",
    category: "feature",
    title: "Facebook + Instagram + TikTok csatlakoztatás",
    description: "A Beállítások → Integrációk oldalon most csatlakoztathatod a Facebook Page-eidet, Instagram Business fiókodat és TikTok-odat. A Content Studio-ból közvetlenül publikálhatsz Facebook + Instagram-ra (TikTok videó-publikálás hamarosan).",
    href: "/beallitasok?tab=integrations",
  },
  {
    id: "2026-06-security-hardening",
    date: "2026-06-24",
    category: "security",
    title: "Biztonsági megerősítés",
    description: "Cookie Secure flag, JWT_SECRET fail-fast, LinkedIn OAuth HMAC state, brute-force rate-limit a login-on, upload-validáció (méret + MIME + magic byte), IDOR-fix a kampányokon, audit log hamisítás blokkolása.",
  },
  {
    id: "2026-06-seo-audit-upgrade",
    date: "2026-06-24",
    category: "improvement",
    title: "SEO Audit — Core Web Vitals + mini-crawl",
    description: "Az audit most Google PageSpeed Insights alapú méréseket ad (LCP, CLS, INP mobil + desktop), 5 aloldalt bejár, és hibás linkeket keres. Az eredmény 5/10-ről 9/10 megbízhatóságra emelkedett.",
    href: "/seo",
  },
  {
    id: "2026-06-hirlevel-fomenu",
    date: "2026-06-20",
    category: "improvement",
    title: "Hírlevél a főmenüben",
    description: "A hírlevél-küldő átkerült a Beállítások alól a főmenübe (super admin). Gyorsabb elérés, saját feliratkozó-lista.",
    href: "/hirlevel",
  },
];
