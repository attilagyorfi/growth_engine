# G2A Growth Engine

> **AI-alapú marketing operációs rendszer ügynökségek és vállalkozások számára**

A G2A Growth Engine egy teljes körű SaaS platform, amely mesterséges intelligenciával segíti a marketing stratégia alkotást, tartalom gyártást, lead generálást és kampánykezelést – egyetlen integrált felületen. A rendszer elsősorban marketing ügynökségek számára készült, akik több ügyfelet kezelnek párhuzamosan, de önálló vállalkozók és növekedési fázisban lévő cégek számára is ideális.

---

## Tartalomjegyzék

1. [Projekt célja](#projekt-célja)
2. [Végső rendeltetés és üzleti modell](#végső-rendeltetés-és-üzleti-modell)
3. [Technológiai stack](#technológiai-stack)
4. [Architektúra áttekintés](#architektúra-áttekintés)
5. [Adatbázis séma](#adatbázis-séma)
6. [Modulok és funkciók](#modulok-és-funkciók)
7. [Autentikáció és jogosultságkezelés](#autentikáció-és-jogosultságkezelés)
8. [Feature gating és előfizetési csomagok](#feature-gating-és-előfizetési-csomagok)
9. [API és tRPC routerek](#api-és-trpc-routerek)
10. [Fejlesztői útmutató](#fejlesztői-útmutató)
11. [Környezeti változók](#környezeti-változók)
12. [Tesztelés](#tesztelés)
13. [Deployment](#deployment)
14. [Roadmap](#roadmap)
15. [Közreműködők és szerepkörök](#közreműködők-és-szerepkörök)

---

## Projekt célja

A G2A Growth Engine célja, hogy a marketing ügynökségek és vállalkozások számára egy olyan egységes operációs rendszert biztosítson, amely:

- **Automatizálja a stratégiaalkotást** – az ügyfél weboldala és iparági adatai alapján AI generál teljes marketing stratégiát, brand DNA-t, célcsoport térképet és versenytárs elemzést.
- **Gyorsítja a tartalomgyártást** – AI-alapú szövegírás (social poszt, email, blog, hirdetés) a brand hangja és a tartalmi pillérek alapján.
- **Kezeli az értékesítési folyamatot** – lead nyilvántartás, kimenő email kampányok, bejövő válaszok kezelése egy helyen.
- **Kampányokat tervez és követ** – kampányok brief-től a publikálásig, jóváhagyási munkafolyamattal.
- **Tanul és fejlődik** – AI memória rögzíti a jóváhagyott és elutasított tartalmakat, hogy a következő generálás pontosabb legyen.

A platform **kétszintű hozzáférési modellt** alkalmaz: a **super admin** (ügynökség) több ügyfél workspace-t kezel, míg a **normál felhasználók** (ügyfelek) csak saját adataikhoz férnek hozzá.

---

## Végső rendeltetés és üzleti modell

### Célpiac

| Szegmens | Leírás |
|---|---|
| Marketing ügynökségek | 3–30 fős csapatok, akik 5–50 ügyfelet kezelnek párhuzamosan |
| Önálló vállalkozók | Freelance marketingesek és tanácsadók |
| Növekedési fázisú KKV-k | 10–200 fős cégek, akiknek nincs dedikált marketing csapatuk |

### Előfizetési csomagok

| Csomag | Ár | AI generálás/hó | Funkciók |
|---|---|---|---|
| **Free** | 0 Ft | 3 | Alap stratégia, 1 profil, korlátozott tartalom |
| **Starter** | ~9 990 Ft/hó | 20 | Teljes stratégia, kampányok, lead kezelés |
| **Pro** | ~24 990 Ft/hó | Korlátlan | Minden funkció, analytics, AI memória |
| **Agency** | ~59 990 Ft/hó | Korlátlan | Multi-workspace, white-label előkészítés, csapatjogosultságok |

### Bevételi modell

A platform SaaS előfizetéses modellben működik. A jövőbeni fejlesztési irány magában foglalja a Stripe alapú önkiszolgáló előfizetés-kezelést, usage-based billing lehetőségét (AI generálások száma alapján), valamint ügynökségi viszonteladói programot.

---

## Technológiai stack

### Frontend

| Technológia | Verzió | Szerepe |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.9 | Típusbiztonság |
| Tailwind CSS | 4 | Utility-first stílusozás |
| shadcn/ui | latest | Komponens könyvtár (Radix UI alapon) |
| Wouter | latest | Kliens oldali routing |
| Framer Motion | latest | Animációk (scroll-triggered, fade-in) |
| TanStack Query | 5 | Szerver állapot kezelés |
| tRPC Client | 11 | Type-safe API hívások |
| Streamdown | latest | Markdown streaming renderelés |

### Backend

| Technológia | Verzió | Szerepe |
|---|---|---|
| Node.js | 22 | Runtime |
| Express | 4 | HTTP szerver |
| tRPC | 11 | Type-safe RPC réteg |
| Drizzle ORM | 0.44 | Adatbázis ORM |
| MySQL / TiDB | latest | Relációs adatbázis |
| bcrypt | latest | Jelszó hash-elés |
| jose | 6.1 | JWT token kezelés |
| Resend | latest | Tranzakcionális email küldés |
| Superjson | 1.13 | Szerializáció (Date, Map, Set támogatás) |

### Infrastruktúra

| Szolgáltatás | Szerepe |
|---|---|
| Manus Platform | Hosting, OAuth, S3 storage, LLM proxy |
| AWS S3 (Manus proxy) | Fájl tárolás (brand assets, dokumentumok) |
| TiDB Cloud | Felhő alapú MySQL kompatibilis adatbázis |
| Vite | Frontend build eszköz |

---

## Architektúra áttekintés

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Landing  │  │Dashboard │  │ Strategy │  │ Content  │   │
│  │  Page    │  │ Layout   │  │  Engine  │  │  Studio  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                    tRPC Client (httpBatchLink)               │
└─────────────────────────────┬───────────────────────────────┘
                              │ /api/trpc
┌─────────────────────────────▼───────────────────────────────┐
│                    EXPRESS SERVER                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  tRPC Router                         │   │
│  │  appAuth │ profiles │ leads │ content │ strategies  │   │
│  │  outbound │ inbound │ campaigns │ intelligence │ ai  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Drizzle ORM │  │  LLM Helper  │  │  S3 Storage  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼─────────────────┼─────────────────┼─────────────┘
          │                 │                 │
    ┌─────▼──────┐   ┌──────▼──────┐   ┌─────▼──────┐
    │  TiDB/MySQL│   │ Manus LLM   │   │  AWS S3    │
    │  Database  │   │   Proxy     │   │  (Manus)   │
    └────────────┘   └─────────────┘   └────────────┘
```

### Kérés folyamat

1. A React kliens tRPC hook-on keresztül hív (`trpc.profiles.list.useQuery()`)
2. A tRPC client `httpBatchLink`-en keresztül POST-ol a `/api/trpc` végpontra
3. Az Express szerver context-et épít (`server/_core/context.ts`): kiolvas JWT cookie-t, azonosítja a felhasználót
4. A tRPC router a megfelelő procedure-t hívja, amely Drizzle ORM-en keresztül lekérdezi az adatbázist
5. A válasz Superjson-nal szerializálva visszakerül a klienshez

---

## Adatbázis séma

A projekt **30 adatbázis táblát** tartalmaz, amelyek az alábbi logikai csoportokba rendezhetők:

### Felhasználók és autentikáció

| Tábla | Leírás |
|---|---|
| `app_users` | Saját email+jelszó alapú felhasználók (email, passwordHash, role, subscriptionPlan) |
| `password_reset_tokens` | Jelszó-visszaállítási tokenek (1 órás lejárat) |
| `users` | Manus OAuth felhasználók (OAuth bridge) |
| `app_notifications` | In-app értesítések |

### Ügyfelek és profilok

| Tábla | Leírás |
|---|---|
| `client_profiles` | Ügyfél workspace (brand beállítások, hang, pillérek, social fiókok) |
| `company_intelligence` | AI-generált cég elemzés (brand DNA, offer map, audience map) |
| `competitor_profiles` | Versenytárs profilok |
| `target_personas` | Célcsoport személyek |
| `uploaded_brand_assets` | S3-ra feltöltött brand dokumentumok |

### Onboarding

| Tábla | Leírás |
|---|---|
| `onboarding_sessions` | Onboarding folyamat állapota |
| `onboarding_answers` | Lépésenkénti válaszok |

### Stratégia és tartalom

| Tábla | Leírás |
|---|---|
| `strategies` | Marketing stratégiák (AI-generált, verziókövetéssel) |
| `strategy_versions` | Stratégia verziók (összehasonlítható) |
| `strategy_tasks` | Stratégiából lebontott feladatok |
| `content_posts` | Tartalom posztok (draft/approved/published) |
| `content_calendar_items` | Naptár bejegyzések |
| `content_feedback` | Jóváhagyási visszajelzések |
| `campaigns` | Kampányok (brief, cél, csatornák, időtáv) |
| `campaign_assets` | Kampányhoz tartozó tartalom elemek |

### Értékesítés

| Tábla | Leírás |
|---|---|
| `leads` | Lead nyilvántartás (cég, kontakt, státusz, forrás) |
| `outbound_emails` | Kimenő email kampányok |
| `inbound_emails` | Bejövő email válaszok |
| `email_integrations` | Email fiók integrációk |

### Analytics és AI

| Tábla | Leírás |
|---|---|
| `analytics_snapshots` | Teljesítmény mérőszámok időbélyeggel |
| `ai_memories` | AI memória (jóváhagyott/elutasított minták) |
| `ai_usage` | AI generálás számláló (havi limit követés) |
| `recommendations` | AI-alapú javaslatok |
| `audit_logs` | Rendszer audit napló |
| `social_tokens` | Social media OAuth tokenek |
| `publishing_logs` | Publikálási napló |

---

## Modulok és funkciók

### 1. Publikus Landing Oldal (`/`)

Kétnyelvű (HU/EN) marketing oldal, amely bemutatja a platform funkcióit, árazását és ügyfélvéleményeket. Framer Motion animációkkal, dark/light mode támogatással.

**Szekciók:** Hero → Statisztikák → Funkciók → Hogyan működik → Árazás → Testimonials → CTA → Footer

### 2. Regisztráció és Bejelentkezés (`/regisztracio`, `/bejelentkezes`)

Kétlépéses regisztrációs folyamat: csomag választás (Free/Starter/Pro) → fiók létrehozás. Jelszó erősség jelző, bcrypt hash, JWT session cookie.

**Elfelejtett jelszó flow:** `/elfelejtett-jelszo` → Resend API email küldés → `/jelszo-visszaallitas?token=...` → új jelszó beállítás.

### 3. Onboarding Wizard (`/onboarding`)

5 lépéses interaktív wizard új ügyfelek számára:

1. **Alapadatok** – weboldal URL scraping + AI prefill (cégnév, iparág, leírás)
2. **Brand & kommunikáció** – brand hangja, stílus, kerülendő szavak, kulcsszavak
3. **Tartalom pillérek** – 5-7 tartalmi pillér meghatározása
4. **Célcsoport** – persona leírások, fájdalompontok, motivációk
5. **WOW kimenet** – AI generált brand DNA, stratégia összefoglaló, content pillérek

LocalStorage alapú draft mentés, visszatöltés banner, onboarding completion flag perzisztálás.

### 4. Dashboard (`/dashboard`)

Operatív vezérlőpult az aktuális feladatokkal:

- **Jóváhagyásra vár** – tartalmak és stratégiák, amelyek döntést igényelnek
- **Heti prioritások** – AI által javasolt legfontosabb teendők
- **Ütemezett tartalmak** – következő 7 nap publikálási terve
- **KPI összefoglaló** – lead count, email teljesítmény, tartalom volumen
- **Aktivitás stream** – legutóbbi műveletek időrendben

### 5. Company Intelligence (`/intelligence`)

AI-generált cég elemzés négy fő blokkal:

- **Brand DNA** – értékek, személyiség, pozicionálás
- **Offer Map** – termékek/szolgáltatások, USP-k, árazás
- **Audience Map** – célcsoport szegmensek, persona-k
- **Competitor Snapshot** – versenytársak erősségei és gyengeségei

### 6. Strategy Engine (`/strategia`)

Stratégiai vezérlőfelület:

- AI stratégia generálás (Company Intelligence kontextusból)
- Verziókövetés és összehasonlítás (side-by-side diff nézet)
- Havi prioritások és heti végrehajtási tábla
- Kapcsolt feladatok és KPI követés
- Auto-dialog: `?autoGenerate=true` URL paraméterrel automatikusan megnyílik

### 7. Content Studio (`/tartalom-studio`)

Tartalom gyártás és kezelés öt tabban:

| Tab | Tartalom |
|---|---|
| **Naptár** | Tartalom naptár nézet |
| **Vázlatok** | Draft tartalmak szerkesztése |
| **Jóváhagyás** | Approval workflow |
| **Publikált** | Közzétett tartalmak archívuma |
| **Assets** | Brand asset könyvtár |

AI quick generate drawer: stratégia-alapú tartalomjavaslatok, tartalomtípus ajánlók (poszt, email, blog, hirdetés), brand hangra hangolt generálás.

### 8. Sales Ops (`/ertekesites`)

Értékesítési folyamat kezelése három tabban:

| Tab | Tartalom |
|---|---|
| **Leads** | Lead nyilvántartás, státusz kezelés, szűrés |
| **Outbound** | Kimenő email kampányok, AI email draft generálás |
| **Replies** | Bejövő email válaszok, thread nézet |

### 9. Campaigns (`/kampanyok`)

Kampány tervező és követő modul:

- Kampány brief form (cél, offer, célcsoport, csatorna, időtáv, CTA, tone)
- AI kampány output: headline, messaging angles, platform posztók, email sorozat, landing page outline
- Kampány asset kezelés

### 10. Analytics (`/analytics`)

Teljesítmény mérőszámok és AI-alapú értelmezés:

- Lead count, email sent/open/reply arányok, tartalom volumen
- AI insight layer: mi teljesít jól/rosszul és miért
- Konkrét következő lépés javaslatok

### 11. Settings (`/beallitasok`)

Négy tabos beállítási oldal:

| Tab | Tartalom |
|---|---|
| **Brand Center** | Logó, színek, betűtípusok, brand guideline |
| **Integrations** | Email, social media integrációk |
| **Team** | Csapattagok és jogosultságok |
| **Audit Log** | Rendszer audit napló |

### 12. Admin Panel (`/admin/users`)

Super admin kizárólagos hozzáférés:

- Felhasználók listája (email, regisztráció, státusz, csomag, role)
- Felhasználó aktiválás/deaktiválás
- Jelszó reset admin által
- Admin CRM: ügyfél workspace adatok (cég, weboldal, kontakt, aktivitás)

---

## Autentikáció és jogosultságkezelés

### Kétszintű auth rendszer

A platform két párhuzamos autentikációs rendszert támogat:

**1. Saját email+jelszó auth** (elsődleges)
- Regisztráció: email, jelszó (bcrypt hash, 12 round), subscriptionPlan
- Bejelentkezés: JWT token, `app_token` HttpOnly cookie, 30 napos lejárat
- Session: `appUserProcedure` middleware ellenőrzi minden védett route-on

**2. Manus OAuth** (másodlagos, fejlesztői hozzáférés)
- OAuth bridge: ha `app_token` nincs, de Manus OAuth session van, automatikusan létrehozza/megtalálja az appUser-t email alapján
- Super admin (g2amarketing) automatikusan `super_admin` role-t kap

### Role-based access control

| Role | Hozzáférés |
|---|---|
| `super_admin` | Minden funkció + Admin panel + összes ügyfél workspace |
| `user` | Csak saját workspace adatai |

### Védett route-ok

```typescript
// Backend – appUserProcedure minden védett műveleten
appUserProcedure.query(({ ctx }) => {
  // ctx.appUser garantáltan létezik
  return getDataForUser(ctx.appUser.id);
});

// Frontend – ProtectedRoute wrapper
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

---

## Feature gating és előfizetési csomagok

### AI használat limitek

```typescript
export const AI_PLAN_LIMITS: Record<string, number> = {
  free: 3,       // 3 AI generálás/hó
  starter: 20,   // 20 AI generálás/hó
  pro: -1,       // korlátlan (-1 = unlimited)
  agency: -1,    // korlátlan
};
```

### Limit ellenőrzés folyamata

1. AI generálás előtt: `checkAiUsageLimit(userId, subscriptionPlan)` → ha limit elérve: `TRPCError FORBIDDEN`
2. Sikeres generálás után: `recordAiUsage(userId)` → `ai_usage` táblába ír
3. Frontend: profil dropdownban csomag badge + progress bar + "Csomag frissítése" CTA ha limit = 0

### Érintett AI procedure-ök

- `intelligence.generate` – Company Intelligence generálás
- `strategy.generate` – Marketing stratégia generálás
- `ai.generatePostContent` – Tartalom generálás (poszt, email, blog)

---

## API és tRPC routerek

### Router struktúra

```
server/routers.ts (fő router)
├── system          – Owner értesítések
├── appAuth         – Regisztráció, login, logout, me, jelszó reset
├── auth            – Manus OAuth (me, logout)
├── profiles        – Ügyfél workspace CRUD
├── leads           – Lead kezelés
├── outbound        – Kimenő emailek
├── inbound         – Bejövő emailek
├── content         – Tartalom posztok
├── strategies      – Stratégiák és verziók
├── intelligence    – Company Intelligence (AI)
├── onboarding      – Onboarding wizard
├── campaigns       – Kampányok
├── analytics       – Analytics snapshots
├── ai              – AI tartalom generálás
├── aiUsage         – AI használat státusz
├── emailIntegration – Email integrációk
└── admin           – Super admin műveletek
```

### Fontosabb procedure-ök

| Procedure | Típus | Leírás |
|---|---|---|
| `appAuth.register` | mutation | Regisztráció (email, jelszó, csomag) |
| `appAuth.login` | mutation | Bejelentkezés, JWT cookie beállítás |
| `appAuth.forgotPassword` | mutation | Resend API email küldés reset tokennel |
| `appAuth.resetPassword` | mutation | Token validálás + új jelszó mentés |
| `appAuth.me` | query | Aktuális felhasználó (subscriptionPlan-nel) |
| `profiles.upsert` | mutation | Ügyfél profil létrehozás/frissítés |
| `intelligence.generate` | mutation | AI Company Intelligence generálás |
| `strategies.generate` | mutation | AI stratégia generálás |
| `ai.generatePostContent` | mutation | AI tartalom generálás |
| `aiUsage.status` | query | Havi AI limit státusz |
| `admin.getClientsCRM` | query | Super admin CRM lista |

---

## Fejlesztői útmutató

### Előfeltételek

- Node.js 22+
- pnpm 9+
- MySQL 8+ vagy TiDB Cloud hozzáférés

### Telepítés

```bash
# Repo klónozása
git clone https://github.com/attilagyorfi/growth_engine.git
cd growth_engine

# Függőségek telepítése
pnpm install

# Környezeti változók beállítása
cp .env.example .env
# Szerkeszd a .env fájlt (lásd: Környezeti változók szekció)

# Adatbázis séma létrehozása
pnpm db:push

# Fejlesztői szerver indítása
pnpm dev
```

A fejlesztői szerver elindul a `http://localhost:3000` címen.

### Fejlesztési munkafolyamat

A projekt a **Build Loop** elvét követi – négy érintési pont:

1. **Séma** – `drizzle/schema.ts` módosítása, majd `pnpm db:push`
2. **DB helper** – `server/db.ts` vagy `server/authDb.ts` bővítése (nyers Drizzle lekérdezések)
3. **Router** – `server/routers.ts` vagy `server/routers/` alatti fájlokban procedure hozzáadása
4. **UI** – `client/src/pages/` alatti oldal frissítése tRPC hook-okkal

### Fájlstruktúra

```
growth_engine/
├── client/
│   ├── src/
│   │   ├── pages/          ← Oldal szintű komponensek
│   │   ├── components/     ← Újrafelhasználható UI (shadcn/ui)
│   │   ├── contexts/       ← React context-ek (Auth, Theme, Language, Profile, Data)
│   │   ├── hooks/          ← Custom hook-ok (useAppAuth, useProfile, useData)
│   │   ├── lib/            ← tRPC kliens, utils
│   │   ├── App.tsx         ← Route-ok és layout
│   │   ├── main.tsx        ← Provider-ek, tRPC inicializálás
│   │   └── index.css       ← Globális stílus, Tailwind 4 theme
│   └── index.html
├── drizzle/
│   ├── schema.ts           ← Adatbázis táblák és típusok
│   ├── relations.ts        ← Tábla kapcsolatok
│   └── migrations/         ← Generált migrációk
├── server/
│   ├── _core/              ← Framework infrastruktúra (OAuth, context, LLM, S3)
│   ├── routers/            ← Feature-specifikus routerek
│   ├── routers.ts          ← Fő tRPC router
│   ├── db.ts               ← Általános DB helper-ek
│   ├── authDb.ts           ← Auth + AI usage DB helper-ek
│   ├── emailSender.ts      ← Resend API email küldő
│   ├── storage.ts          ← S3 file storage helper-ek
│   └── index.ts            ← Express szerver belépési pont
├── shared/
│   ├── const.ts            ← Megosztott konstansok
│   └── types.ts            ← Megosztott TypeScript típusok
├── todo.md                 ← Sprint alapú fejlesztési napló
├── ideas.md                ← Ötletek és jövőbeni funkciók
└── vitest.config.ts        ← Teszt konfiguráció
```

### Kód konvenciók

- **TypeScript strict mode** – minden fájlban kötelező típusok
- **tRPC-first** – soha ne használj `fetch`/`axios` wrapper-t, mindig `trpc.*` hook-okat
- **Optimistic updates** – lista műveleteknél `onMutate`/`onError`/`onSettled` pattern
- **Drizzle ORM** – nyers SQL helyett mindig ORM lekérdezések
- **Tailwind 4 OKLCH** – `oklch()` színformátum a CSS változókban (nem HSL)
- **Magyar UI szövegek** – minden felhasználói felület szöveg magyarul

---

## Környezeti változók

A projekt a Manus platform által automatikusan injektált változókat használja. Lokális fejlesztéshez `.env` fájlban kell megadni:

| Változó | Leírás | Kötelező |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string | ✅ |
| `JWT_SECRET` | Session cookie aláíró kulcs | ✅ |
| `RESEND_API_KEY` | Resend API kulcs (email küldés) | ✅ |
| `EMAIL_FROM` | Feladó email cím (pl. `noreply@g2amarketing.hu`) | ✅ |
| `VITE_APP_ID` | Manus OAuth alkalmazás ID | ✅ |
| `OAUTH_SERVER_URL` | Manus OAuth backend URL | ✅ |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL | ✅ |
| `OWNER_OPEN_ID` | Tulajdonos Manus ID | ✅ |
| `OWNER_NAME` | Tulajdonos neve | ✅ |
| `BUILT_IN_FORGE_API_URL` | Manus beépített API URL (LLM, S3) | ✅ |
| `BUILT_IN_FORGE_API_KEY` | Manus beépített API kulcs (szerver) | ✅ |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus API kulcs (frontend) | ✅ |
| `VITE_FRONTEND_FORGE_API_URL` | Manus API URL (frontend) | ✅ |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint | ⬜ |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID | ⬜ |

> **Fontos:** Soha ne commitolj `.env` fájlt a repóba. A `.gitignore` már tartalmazza.

---

## Tesztelés

```bash
# Összes teszt futtatása
pnpm test

# Teszt fájlok helye
server/auth.logout.test.ts        ← Auth logout teszt
server/auth.oauth-bridge.test.ts  ← OAuth bridge tesztek
server/ai.usage.test.ts           ← AI usage limit tesztek
```

### Teszt lefedettség

| Modul | Tesztek | Státusz |
|---|---|---|
| Auth logout | 1 | ✅ |
| OAuth bridge | 3 | ✅ |
| AI usage limits | 7 | ✅ |
| **Összesen** | **11** | **✅ mind átment** |

A tesztek Vitest-tel futnak, TypeScript natív támogatással. Új feature-höz kötelező tesztet írni a `server/*.test.ts` mintát követve.

---

## Deployment

### Manus Platform (ajánlott)

A projekt a Manus platformon fut, ahol a deployment a Management UI-ból indítható:

1. Checkpoint mentése: `webdev_save_checkpoint`
2. Publish gomb a Management UI fejlécében

**Éles URL:** `https://g2a-growth-engine.manus.space`

### Manuális deployment

```bash
# Build
pnpm build

# Indítás (production)
NODE_ENV=production node dist/index.js
```

A build kimenet a `dist/` mappában:
- `dist/index.js` – Express szerver bundle
- `dist/public/` – Vite által buildelt React app

> **Megjegyzés:** A szerver portját a `PORT` környezeti változó határozza meg (nincs hardcode-olva).

---

## Roadmap

### Sprint 12 – Stripe integráció (következő)
- [ ] Stripe Checkout önkiszolgáló előfizetés-kezelés
- [ ] Free → Starter/Pro upgrade flow
- [ ] Webhook: előfizetés aktiválás/lemondás kezelés
- [ ] Számlázási portal

### Sprint 13 – Rate limiting és biztonság
- [ ] Auth rate limiting (register/login/forgot-password: 5 kísérlet/perc)
- [ ] Brute-force védelem + audit log
- [ ] CSRF védelem
- [ ] Input sanitization audit

### Sprint 14 – Valódi integrációk
- [ ] LinkedIn OAuth + publishing API
- [ ] Meta/Facebook/Instagram integráció
- [ ] Gmail/Outlook API monitoring
- [ ] Google Business Profile

### Sprint 15 – Analytics Feedback Loop
- [ ] Post performance rögzítés
- [ ] Email open/click tracking
- [ ] AI Memory aktiválás (jóváhagyott/elutasított minták)
- [ ] Recommendation engine

### Sprint 16 – Agency Readiness
- [ ] Client switcher top barba (kereshető, legutóbbi kliensek)
- [ ] Team permissions bővítése
- [ ] White-label előkészítés
- [ ] Export funkciók (PDF stratégia, CSV leads)

---

## Közreműködők és szerepkörök

| Szerepkör | Feladatkör |
|---|---|
| **Product Owner** | Attila Györfi – üzleti követelmények, prioritizálás, sprint tervezés |
| **AI Development** | Manus AI – teljes szoftver fejlesztés (frontend, backend, DB, tesztek) |
| **Design** | Manus AI – UI/UX tervezés, komponens könyvtár, animációk |
| **DevOps** | Manus Platform – hosting, CI/CD, adatbázis, S3 |

### Fejlesztési napló

A teljes fejlesztési történet és sprint összefoglalók a `todo.md` fájlban találhatók. A projekt 11 sprinten keresztül fejlődött az MVP 1.0-tól a jelenlegi Sprint 11-es állapotig.

---

## Licenc

MIT License – részletekért lásd a `LICENSE` fájlt.

---

*Utoljára frissítve: 2026. április 22. | Verzió: Sprint 11 (047fb088)*
