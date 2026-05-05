# G2A Growth Engine – Fejlesztői Kézikönyv

> **Célközönség:** Ez a dokumentum Claude AI (vagy más LLM) számára készült, hogy kontextus nélkül is folytatni tudja a fejlesztést. Tartalmazza a projekt célját, architektúráját, az összes eddigi fejlesztési sprintet, a nyitott feladatokat és a kritikus döntéseket.

---

## 1. Projekt áttekintés

### Mi ez?

A **G2A Growth Engine** egy magyar nyelvű, B2B fókuszú AI-alapú marketing SaaS platform. Célja, hogy kis- és középvállalkozások, illetve marketing ügynökségek számára egyetlen felületen kezelje a teljes marketing workflow-t: stratégiától a tartalomgyártáson és lead generáláson át az analitikáig.

### Célcsoport

- Kis- és középvállalkozások (1–50 fő), amelyek nem engedhetnek meg dedikált marketing csapatot
- Marketing ügynökségek, amelyek több ügyfelet kezelnek egyszerre
- Elsősorban magyar piac, HUF árazás, magyar interfész

### Verziók és árazás

| Csomag | Havi ár | Éves ár | Célcsoport |
|--------|---------|---------|------------|
| Ingyenes | 0 Ft | – | Kipróbálás |
| Starter | 9 900 Ft | 99 000 Ft/év | KKV-k |
| Pro | 24 900 Ft | 249 000 Ft/év | Növekvő vállalkozások |
| Agency | 49 900 Ft | 499 000 Ft/év | Ügynökségek |

Az éves előfizetés 2 hónap ingyenes (~17% kedvezmény). A Stripe integráció be van kötve, de a sandbox igénylés még szükséges.

---

## 2. Tech stack

| Réteg | Technológia |
|-------|-------------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Wouter (routing), Framer Motion |
| UI komponensek | shadcn/ui (Radix UI alapú), Lucide icons, Recharts |
| Backend | Node.js, Express 4, tRPC 11 |
| Adatbázis | MySQL (TiDB), Drizzle ORM |
| Auth | Saját email+jelszó auth (JWT, bcrypt), Manus OAuth bridge |
| AI | Manus Built-in LLM API (`invokeLLM`), HeyGen (videó), DALL-E (képek) |
| Fájltárolás | AWS S3 (Manus managed) |
| Fizetés | Stripe (checkout sessions + webhooks) |
| Email | Resend |
| Tesztek | Vitest |

### Kulcsfájlok

```
drizzle/schema.ts          → Adatbázis sémák (SSOT)
server/routers.ts          → Összes tRPC procedure (~2200 sor, splitolni kell!)
server/routers/appAuth.ts  → Email+jelszó auth, admin műveletek
server/stripe/             → Stripe webhook + termékdefiníciók
server/authDb.ts           → AI kvóta ellenőrzés (AI_PLAN_LIMITS)
server/_core/index.ts      → Express server bootstrap, middleware sorrend
client/src/App.tsx         → Route-ok, hozzáférés-vezérlés
client/src/index.css       → Quiet Authority design tokens
client/src/pages/          → Összes oldal (magyar URL-ek)
client/src/components/     → Újrafelhasználható komponensek
```

---

## 3. Adatbázis séma – táblák összefoglalója

| Tábla | Leírás |
|-------|--------|
| `users` | Manus OAuth felhasználók |
| `app_users` | Saját email+jelszó auth felhasználók (fő auth rendszer) |
| `client_profiles` | Ügyfélprofilok (brand, szín, hang, tartalom pillérek) |
| `leads` | CRM lead-ek (státusz: new → closed_won/lost) |
| `outbound_emails` | Kimenő email drafts + küldési státusz |
| `inbound_emails` | Bejövő email válaszok (kategorizálva) |
| `content_posts` | Social media posztok (draft → approved → published) |
| `strategies` | Havi marketing stratégiák |
| `strategy_versions` | Stratégia verziók (quickWins, nextActions, weeklySpints) |
| `strategy_tasks` | Stratégiából generált feladatok (todo/in_progress/done) |
| `content_calendar_items` | Tartalomnaptár bejegyzések |
| `campaigns` | Kampányok (brief, célcsoport, csatornák) |
| `campaign_assets` | Kampány eszközök (copy, image, video) |
| `company_intelligence` | AI-generált cégprofil (brandDNA, offerMap, audienceMap) |
| `competitor_profiles` | Versenytárs profilok |
| `target_personas` | Célcsoport personák |
| `ai_memories` | AI tanulási minták (approved/rejected patterns) |
| `ai_usage` | AI kvóta tracking (action + month + appUserId) |
| `uploaded_brand_assets` | Feltöltött brand anyagok (S3 URL + parsed content) |
| `analytics_snapshots` | Platform analitika pillanatképek |
| `social_tokens` | Social media OAuth tokenek |
| `publishing_logs` | Közzétételi naplók |
| `recommendations` | AI ajánlások (strategy/content/campaign) |
| `onboarding_sessions` | Onboarding folyamat állapota |
| `onboarding_answers` | Onboarding válaszok (step-by-step) |
| `audit_logs` | Audit napló |
| `password_reset_tokens` | Jelszó visszaállítás tokenek |
| `email_integrations` | Gmail/Outlook integráció tokenek |

### Kritikus `app_users` mezők

```typescript
subscriptionPlan: "free" | "starter" | "pro" | "agency"
subscriptionBilling: "monthly" | "yearly"
stripeCustomerId: string | null
stripeSubscriptionId: string | null
onboardingCompleted: boolean
role: "super_admin" | "user"
profileId: string | null  // kapcsolat a client_profiles táblával
```

---

## 4. Hozzáférés-vezérlés és routing

### Route guard-ok (App.tsx)

```
AppRoute         → bejelentkezés + onboarding szükséges (super_admin bypass)
OnboardingRoute  → csak bejelentkezett, onboarding nélküli user
AdminRoute       → csak super_admin
PublicOnlyRoute  → átirányít, ha már be van jelentkezve
```

### URL struktúra (magyar)

```
/                    → Landing oldal
/bejelentkezes       → Login
/regisztracio        → Register (csomag választó)
/iranyitopult        → Dashboard (főoldal)
/ugyfelek            → Clients (ügyfél lista)
/strategia           → Strategy (AI stratégia generátor)
/content-studio      → ContentStudio (poszt generátor)
/sales-ops           → SalesOps (lead + email kezelés)
/kampanyok           → Campaigns (kampány kezelő)
/analitika           → Analytics (KPI dashboard)
/seo-audit           → SEO Audit
/video-studio        → VideoStudio (HeyGen integráció)
/intelligence        → Intelligence (cégprofil AI elemzés)
/beallitasok         → Settings (profil, brand, billing)
/projektek           → Projects (super_admin)
/admin/felhasznalok  → Admin Users (super_admin)
```

### Super admin

- Email: `admin@g2a.hu` – automatikusan `super_admin` role-t kap regisztrációkor
- Bypass-olja az onboarding-ot
- Hozzáfér az `/admin/felhasznalok` és `/projektek` oldalakhoz
- Korlátlan AI kvóta (agency-szintű)

---

## 5. AI kvóta rendszer

### `AI_PLAN_LIMITS` struktúra (server/authDb.ts)

```typescript
{
  free:    { strategy: 1, contentPlan: 1, post: 3, campaign: 1, image: 2, video: 0, seo: 1, intelligence: 1, dailyTasks: 3 },
  starter: { strategy: 5, contentPlan: 5, post: 30, campaign: 5, image: 20, video: 2, seo: 10, intelligence: 3, dailyTasks: 30 },
  pro:     { strategy: 15, contentPlan: 15, post: 100, campaign: 15, image: 60, video: 8, seo: 30, intelligence: 10, dailyTasks: 100 },
  agency:  { strategy: -1, contentPlan: -1, post: -1, campaign: -1, image: -1, video: 20, seo: -1, intelligence: -1, dailyTasks: -1 }
}
```

- `-1` = korlátlan
- Tracking: `ai_usage` tábla, `month: "YYYY-MM"` formátum
- Soft limit (80%): warning flag a `aiUsage.status` response-ban
- Ellenőrzés: `checkAiUsageLimit(userId, plan, feature)` minden AI hívás előtt

---

## 6. Stripe integráció

### Állapot

- ✅ Stripe npm csomag telepítve
- ✅ `server/stripe/products.ts` – plan definíciók HUF árakkal
- ✅ `server/stripe/webhook.ts` – `checkout.session.completed` → `subscriptionPlan` frissítés
- ✅ Webhook route regisztrálva `express.raw()` ELŐTT `express.json()`-hoz képest
- ✅ `stripe.createCheckout` + `stripe.getPortalUrl` tRPC procedure-ök
- ✅ `BillingPlanCards.tsx` – valódi checkout + portal link
- ⚠️ **Sandbox igénylés szükséges!** Határidő: 2026. június 29.
  URL: `https://dashboard.stripe.com/claim_sandbox/YWNjdF8xVE9FOWJMcDh3SVRjVHZyLDE3NzgxNTYzMTAv1007oOMBdql`

### Tesztelés

- Teszt kártyaszám: `4242 4242 4242 4242`
- Checkout success URL: `/beallitasok?tab=billing&checkout=success`
- A Billing tab-on zöld banner jelenik meg sikeres fizetés után

### Termékek (products.ts)

```
Starter havi: 9 900 Ft  | éves: 99 000 Ft
Pro havi:    24 900 Ft  | éves: 249 000 Ft
Agency havi: 49 900 Ft  | éves: 499 000 Ft
```

---

## 7. Design rendszer – Quiet Authority

### Paletta (index.css)

```css
--qa-bg:       #0A0B0F   /* Legmélyebb háttér */
--qa-surface:  #13151B   /* Kártyák, panelek */
--qa-surface2: #1C1F28   /* Emelt felületek */
--qa-surface3: #252836   /* Hover állapotok */
--qa-surface4: #2E3244   /* Aktív elemek */
--qa-border:   #2A2D3A   /* Keretek */
--qa-accent:   #3D7BFD   /* Elsődleges kék */
--qa-fg:       #F0F2F8   /* Elsődleges szöveg */
--qa-fg2:      #9BA3B8   /* Másodlagos szöveg */
--qa-fg3:      #5C6480   /* Halványabb szöveg */
--qa-success:  #22C55E
--qa-warning:  #F59E0B
--qa-danger:   #EF4444
```

### Tipográfia

- **Display (32px):** Sora, 700 – főcímek
- **H1 (24px):** Sora, 600 – oldal fejlécek
- **H2 (18px):** Inter, 600 – szekció fejlécek
- **Body (15px):** Inter, 400 – alap szöveg
- **Small (13px):** Inter, 400 – másodlagos szöveg
- **Caption (12px):** Inter, 500 – badge-ek, feliratok
- **Micro (10px):** Inter, 500 – meta adatok
- **Label (8px):** Inter, 700, uppercase, letter-spacing – kategória jelölők

### Spacing grid

8px alapú: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`, `--space-12: 48px`, `--space-16: 64px`

---

## 8. Elvégzett fejlesztések (sprint összefoglaló)

### Sprint 1–10: Alapinfrastruktúra
- Email+jelszó auth (register, login, logout, password reset)
- Onboarding wizard (7 lépéses, AI-asszisztált)
- Client profile CRUD
- DashboardLayout sidebar navigáció
- Landing oldal (hero, features, pricing, roadmap)

### Sprint 11–20: Core funkciók
- CRM / Leads kezelés (státusz pipeline)
- Outbound email draft + approval workflow
- ContentStudio (AI poszt generálás, platform választó)
- Strategy oldal (AI havi stratégia generálás)
- Intelligence oldal (cégprofil AI elemzés, brandDNA)

### Sprint 21–30: Bővítések
- Campaigns kezelő (brief generálás AI-val)
- Analytics dashboard (valódi DB adatok, havi trend)
- SEO Audit oldal
- VideoStudio (HeyGen integráció)
- AI Writer (szabad szöveges AI asszisztens)

### Sprint 31–40: Minőség és stabilitás
- Vitest tesztek (53 teszt, 100% pass rate)
- TypeScript strict mode, 0 hiba
- Onboarding tesztek
- AI usage tracking tesztek

### Sprint 41: Per-feature kvóta rendszer
- `AI_PLAN_LIMITS` per-feature struktúra (strategy/post/image/video/seo stb.)
- `checkAiUsageLimit` feature-specifikus ellenőrzéssel
- `aiUsage.status` per-feature breakdown
- Dashboard AI Kredit Widget (progress bar, feature breakdown)

### Sprint 42–43: Árazás felülvizsgálat
- Piaci benchmark alapján új árak: 9 900 / 24 900 / 49 900 Ft
- Éves előfizetés: 99 000 / 249 000 / 499 000 Ft/év
- AI API cost kalkuláció (margin: 72–94%)

### Sprint 44–46: Billing + Agency csomag + Éves kapcsoló
- Agency csomag (49 900 Ft/hó) a Landing + Register oldalakon
- Settings → Billing tab (`?tab=billing`)
- Éves/havi kapcsoló a Landingon (animált, -17% badge)
- UpgradePrompt frissítve konkrét kvótákkal

### Sprint 47–49: Register éves kapcsoló + Dashboard KPI + Stripe
- Register.tsx éves/havi kapcsoló szinkronizálva
- Dashboard KPI: AI Tartalmak + Aktív Kampányok + AI Kreditek
- Stripe integráció: webhook, checkout, portal, DB migráció

### Quiet Authority Fázis 01–04: Teljes redesign
- Design tokens: Quiet Authority paletta (mélyebb, csendesebb)
- Komponens-réteg: button, badge, input, tabs, skeleton QA tokenekre
- 19 képernyő hardkódolt oklch értékei CSS változókra cserélve
- EmptyState v2, hover microinterakciók, focus ring egységesítés

### Sprint 50–54: Magyar-only + AI engine bővítés
- Nyelvváltó eltávolítva, csak magyar interfész
- Landing.tsx teljesen HU-only (összes EN ternáris eltávolítva)
- Checkout success banner (Settings → Billing tab)
- Visual brief + CTA javaslat az AI poszt generálásban (ContentStudio)
- Strategy → task breakdown (`generateTasks` procedure + UI gomb)
- Content calendar feltöltése stratégiából (CTA gomb → /content-studio)

---

## 9. Nyitott fejlesztési irányok (prioritás szerint)

### P0 – Azonnali (Stripe aktiválás)
- [ ] Stripe sandbox igénylése (határidő: 2026. jún. 29.)
- [ ] Éles fizetési teszt `4242 4242 4242 4242` kártyával
- [ ] Webhook ellenőrzés: `subscriptionPlan` frissül-e a DB-ben

### P1 – Következő sprint
- [ ] **Strategy Tasks oldal** – A `generateTasks` már menti a feladatokat a DB-be (`strategy_tasks` tábla), de nincs dedikált UI. Kell egy „Feladatok" tab a Strategy oldalon: lista nézet, státusz módosítás (todo → in_progress → done), szűrés funnelStage szerint.
- [ ] **Checkout success banner animáció** – Jelenleg csak egy zöld div, lehetne konfetti animáció (canvas-confetti npm csomag).
- [ ] **Register.tsx éves/havi szinkronizálás** – A step 2 összefoglaló még nem mutatja az éves árat helyesen minden esetben.

### P2 – Középtávú
- [ ] **90 napos marketingterv generálás** – A Strategy oldal jelenleg havi terveket generál. Kell egy „Negyedéves terv" gomb, ami 3 hónapra előre generál prioritásokat és KPI-okat.
- [ ] **Kampány elemek automatikus naptárba kerülése** – Ha egy kampányhoz content ideas-t generál az AI, azok automatikusan kerüljenek be a `content_calendar_items` táblába.
- [ ] **Approval workflow finomítás** – A content_posts `review` státuszban lévő posztokhoz email értesítés küldése a profil tulajdonosának (Resend integráció már megvan).
- [ ] **AI Memory tanulás UI** – Az `ai_memories` tábla már létezik, de nincs UI a tárolt minták megtekintéséhez/törléshez. Kell egy „AI Memória" szekció a Settings-ben.

### P3 – Hosszútávú
- [ ] **Social media közzététel** – A `social_tokens` tábla és `publishing_logs` megvan, de a tényleges API hívások (LinkedIn, Facebook, Instagram) nincsenek implementálva.
- [ ] **Éves előfizetés `mode: "subscription"` váltás** – Jelenleg `mode: "payment"` (egyszeri díj). Visszatérő éves számlázáshoz `mode: "subscription"` + `recurring: { interval: "year" }` kell a `products.ts`-ben.
- [ ] **Inbound email integráció** – A `inbound_emails` tábla és `email_integrations` megvan, de a Gmail/Outlook OAuth flow nincs teljesen implementálva.
- [ ] **Analytics export** – CSV/PDF export gomb az Analytics oldalon.
- [ ] **White label** – Agency csomag feature: saját domain + logo a platform-on.

---

## 10. Kritikus döntések és konvenciók

### Auth rendszer

A projekt **saját email+jelszó auth**-ot használ (`app_users` tábla, JWT cookie `app_token` névvel), **nem** a Manus OAuth-ot (az csak a Manus platform belső használatára van). Az `appAuth.me` tRPC procedure az `app_token` cookie-t olvassa.

### tRPC router méret

A `server/routers.ts` ~2200 soros. Ha tovább nő, split-elni kell `server/routers/` mappába. A `server/routers/appAuth.ts` már ki van emelve mintaként.

### Adatbázis ID-k

Minden tábla `varchar(64)` primary key-t használ (nem auto-increment int), kivéve néhány régebbi tábla. Az ID-k `nanoid()` vagy `crypto.randomUUID()` alapúak.

### Profil kontextus

Minden felhasználóhoz tartozik egy `clientProfile` (az `app_users.profileId` mezőn keresztül). Az onboarding hozza létre. A legtöbb tRPC procedure `profileId`-t vár inputként, amit a frontend a `ProfileContext`-ből olvas.

### Képek és médiatartalmak

**SOHA** ne tárold képeket a `client/public/` mappában. Minden statikus asset az S3-on van (`manus-upload-file --webdev` paranccsal feltöltve). A CDN URL-eket közvetlenül a kódban kell használni.

### Tesztek

```bash
pnpm test        # Vitest futtatás
pnpm db:push     # Schema migráció (drizzle-kit generate + migrate)
pnpm dev         # Dev server (port: 3000)
pnpm build       # Production build
```

Jelenlegi teszt állapot: **53/53 zöld**, TypeScript: **0 hiba**.

---

## 11. Környezeti változók

Automatikusan injektálva (nem kell kézzel beállítani):

```
DATABASE_URL              MySQL/TiDB connection string
JWT_SECRET                Session cookie signing
VITE_APP_ID               Manus OAuth app ID
OAUTH_SERVER_URL          Manus OAuth backend
VITE_OAUTH_PORTAL_URL     Manus login portal (frontend)
BUILT_IN_FORGE_API_URL    Manus built-in API (LLM, storage, stb.)
BUILT_IN_FORGE_API_KEY    Bearer token (server-side)
VITE_FRONTEND_FORGE_API_KEY  Bearer token (frontend)
STRIPE_SECRET_KEY         Stripe secret (auto-injected)
VITE_STRIPE_PUBLISHABLE_KEY  Stripe public key (auto-injected)
STRIPE_WEBHOOK_SECRET     Stripe webhook signing secret
RESEND_API_KEY            Email küldés
```

---

## 12. GitHub repo

```
https://github.com/attilagyorfi/growth_engine
```

Branch: `main` – mindig a legfrissebb, deployolt verzió.

---

## 13. Fontos emlékeztetők

1. **Stripe sandbox igénylés** – 2026. június 29-ig kell igényelni, különben elvész a teszt környezet.
2. **Éves előfizetés billing módja** – Jelenleg `mode: "payment"` (egyszeri díj). Ha visszatérő éves számlázást szeretnél, váltsd `mode: "subscription"`-ra.
3. **routers.ts splitolása** – Ha a fájl 2500 sor fölé nő, split-elni kell `server/routers/` mappába.
4. **AI Memory UI** – Az `ai_memories` tábla tele van adattal, de nincs UI hozzá.
5. **Social publishing** – A `social_tokens` és `publishing_logs` infrastruktúra kész, de az API hívások hiányoznak.

---

*Utolsó frissítés: 2026. május 05. | Verzió: checkpoint `5f973e7c`*
