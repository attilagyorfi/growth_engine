# G2A Growth Engine – MVP 2.0 TODO

## Fázis 1 – Onboarding + Company Intelligence
- [x] Adatbázis séma bővítése (14 új tábla)
- [x] Backend tRPC routerek: onboarding, company intelligence, AI writing
- [x] Onboarding Wizard UI – 1.1 Alapadatok (website scraping + AI prefill)
- [x] Onboarding Wizard UI – 1.2 Brand & kommunikáció (dokumentumfeltöltés)
- [x] Onboarding Wizard UI – 1.3 Működés & erőforrások + WOW kimenet
- [x] Company Intelligence oldal (brand DNA, offer map, audience map, competitor snapshot)
- [x] Navigáció frissítése (Company Intelligence, AI Writer, Új Ügyfél menüpontok)

## Fázis 2 – AI Writing Engine
- [x] AI email draft generálás (brandVoice + lead adatok alapján)
- [x] AI social post draft generálás (contentPillars + stratégia alapján)
- [ ] Visual brief generálás
- [ ] CTA javaslat generálás

## Fázis 3 – Strategy Engine bővítés
- [ ] Strategy → task breakdown logika
- [ ] Content calendar feltöltése stratégiából
- [ ] 90 napos marketingterv generálás

## Fázis 4 – Approval Workflow + Szerepkörök
- [ ] Szerepkör alapú hozzáférés (Owner, Admin, Manager, Editor, Approver, Analyst, Client, Partner)
- [ ] Approval workflow (draft → review → approved → scheduled → published → analyzed)
- [ ] Ügyfél portal logika

## Fázis 5 – Valódi Integrációk
- [ ] LinkedIn OAuth + publishing
- [ ] Meta/Facebook/Instagram integráció
- [ ] Gmail/Outlook API monitoring
- [ ] TikTok, Google Business Profile (később)

## Fázis 6 – Analytics Feedback Loop + AI Memory
- [ ] Post performance rögzítés
- [ ] Email open/click tracking
- [ ] AI Memory (jóváhagyott/elutasított minták)
- [ ] Audit Log modul
- [ ] Recommendation engine

## MVP 3.0 – UX Átszervezés (AKTUÁLIS)

### Navigáció és Routing
- [x] DashboardLayout sidebar átírása: 7 fő menüpont (Dashboard, Clients, Strategy, Content Studio, Sales Ops, Analytics, Settings)
- [x] App.tsx routing frissítése (régi route-ok törlése, új route-ok hozzáadása)
- [x] AI Writer eltávolítása a főnavigációból (beágyazott marad)
- [x] Social Media eltávolítása a főnavigációból (Settings/Integrations alá kerül)
- [x] Profile eltávolítása a főnavigációból (Settings alá kerül)

### Dashboard
- [x] Dashboard operatív átírása: Needs Approval, This Week's Priorities, Scheduled Next 7 Days, Top Insight, At-risk Items
- [x] Másodlagos blokk: KPI summary, activity stream, recent content, latest replies

### Content Studio
- [x] Content és ContentCreator összevonása egyetlen ContentStudio oldallá
- [x] Tabok: Calendar, Drafts, Approval, Published, Assets
- [x] AI quick generate drawer beágyazása a Content Studio-ba

### Sales Ops
- [x] Leads + Outbound + Inbound (Replies) összevonása SalesOps oldallá
- [x] Tabok: Leads, Outbound, Replies
- [x] Email szerkesztés drawer-be (nem modal)

### Strategy
- [x] Strategy aktív vezérlőfelületté alakítása
- [x] Strategic summary, monthly priorities, weekly execution board, linked tasks, KPI tracking

### Onboarding / Clients Flow
- [ ] WOW screen CTA-k: Approve Intelligence, Generate 90-day Strategy, Create First Content Calendar
- [x] Clients oldal: client list + onboarding + intelligence review aloldalak
- [ ] User journey: Create Client → Onboarding → Intelligence Review → WOW → Strategy → Content Calendar

### Settings
- [x] Settings összevonás: Brand Center + Integrations + Team & Permissions + Audit Log tabok

### UX Javítások
- [x] Kliensváltás UX megerősítése (hangsúlyos aktív ügyfél, transition state, megerősítés kritikus műveleteknél)
- [x] Modal-to-drawer refaktor: email szerkesztés, stratégia részletek, content review → right-side drawer

## MVP 4.0 – SaaS Kétszintű Rendszer (AKTUÁLIS)

### Onboarding Javítás
- [x] Onboarding befejezés mentési hibájának diagnosztizálása
- [x] onboarding_completed flag perzisztálása user profilhoz
- [x] Visszalépés után ne induljon újra az onboarding

### Adatbázis
- [x] users tábla: email, passwordHash, role (super_admin/user), onboardingCompleted
- [x] user_profiles kapcsolótábla (userId → profileId)
- [x] Migrációk futtatása (pnpm db:push)

### Auth Backend
- [x] Regisztráció tRPC procedure (email + jelszó, bcrypt hash)
- [x] Bejelentkezés procedure (email + jelszó, JWT session)
- [x] Elfelejtett jelszó flow (email token, reset)
- [x] Me procedure (session validáció)
- [x] Logout procedure

### Landing Oldal
- [x] Publikus landing oldal (hero, features, pricing, CTA)
- [x] Ingyenes verzió árazási kártya
- [x] Navigáció: Logo, Funkciók, Árazás, Bejelentkezés, Regisztráció

### Auth UI
- [x] Regisztrációs oldal (email, jelszó, megerősítés)
- [x] Bejelentkezési oldal
- [x] Elfelejtett jelszó oldal

### Super Admin Panel
- [x] Users lista oldal (email, regisztráció dátuma, státusz, role)
- [x] Felhasználói profil megtekintése/szerkesztése adminként
- [x] Jelszó reset admin által
- [x] Felhasználó aktiválás/deaktiválás

### Felhasználói Workspace
- [x] Bejelentkezés után onboarding flow (ha nem teljesített)
- [x] Onboarding után dashboard megjelenítése
- [x] Adatok izolálása: user csak saját profilát látja
- [x] Más felhasználók nem láthatók

### Magyar Nyelvűség
- [x] Minden menüpont magyarul
- [x] Összes UI szöveg magyarul
- [x] AI prompt-ok magyar outputra hangolva
- [x] Form labelek, hibaüzenetek, toast-ok magyarul

### Routing & Jogosultság
- [x] Publikus route-ok (landing, login, register)
- [x] User route-ok (onboarding, dashboard, workspace)
- [x] Admin route-ok (users panel, system settings)
- [x] Unauthorized redirect logika

## MVP 5.0 – Super Admin, i18n, Onboarding UX, Logo

- [x] Super admin fiók létrehozása (g2amarketing / info@g2amarketing.hu / GY-az1993)
- [x] Nyelvváltó (HU/EN) – i18n context + fordítási fájlok + UI kapcsoló
- [x] Onboarding popup magyarázók minden lépésnél
- [x] 3 logo variáció generálása (meglevő logo megtartva)
- [x] Logo integrálása a platformba (meglevő logo megtartva)
- [x] Fejlesztési összefoglaló dokumentum (szoftverfejlesztőnek)
- [x] UI/UX részletek dokumentáció (házon belüli megbeszéléshez)

## Sprint 1 – Kritikus technikai stabilizáció

- [x] userId alapú adatizoláció: profiles router
- [x] userId alapú adatizoláció: leads router
- [x] userId alapú adatizoláció: content router
- [x] userId alapú adatizoláció: strategies router
- [x] userId alapú adatizoláció: outbound/inbound email routerek
- [x] Super admin vs. normál user jogosultság szétválasztása minden routerben
- [ ] SMTP / SendGrid integráció (email infrastruktúra)
- [ ] Password reset email tényleges kiküldése
- [ ] Outbound email tényleges kiküldése
- [ ] Email státuszok: draft / queued / sent / failed
- [ ] Auth rate limiting: register / login / forgot-password endpointok
- [ ] Brute-force védelem + hibák auditálása
- [ ] Auth flow tesztek (Vitest)
- [ ] Adatizolációs tesztek (Vitest)
- [ ] Onboarding completion logika tesztje (Vitest)
- [ ] Strategy/content/sales alap tesztek (Vitest)

## Sprint 2 – Company Intelligence + Strategy core

- [ ] company_intelligence DB tábla létrehozása (20+ mező)
- [ ] Company Intelligence szerkeszthető profiloldal UI
- [ ] Onboarding adatok átmigrálása Company Intelligence-be
- [ ] Minden AI-generálás Company Intelligence kontextusból indul
- [ ] Strategy modul többszintűsítése: negyedéves / havi / heti / napi szintek
- [x] strategy_versions tábla + verziókövetés UI
- [x] AI next-action blokkok a Strategy oldalon
- [ ] KPI-adatok alapján módosítási javaslatok

## Sprint 3 – Campaign Builder + Naptár

- [x] campaigns DB tábla + campaign_assets tábla
- [x] Campaign Builder UI: brief form (cél, offer, célcsoport, csatorna, időtáv, CTA, tone)
- [x] AI kampány output: headline, messaging angles, platform posztók, email sorozat, landing page outline
- [ ] Kampány elemek automatikus naptárba kerülése
- [ ] Havi/heti calendar view (valódi naptár nézet)
- [ ] Drag-and-drop tartalom ütemezés
- [ ] Approval workflow finomítás + bulk approve funkció
- [ ] Kampánycsoportosítás és platformszűrés a naptárban

## Sprint 4 – Analytics + Ajánlások + Értesítések

- [ ] Analytics performance layer: lead count, email sent/open/reply, content volume
- [ ] Analytics insight layer: AI-alapú értelmezés (mi teljesít jól/rosszul)
- [ ] Analytics action layer: konkrét következő lépés javaslatok
- [ ] recommendations DB tábla + AI recommendation engine
- [ ] In-app értesítési rendszer (approval ready, new lead, reply received, campaign deadline)
- [ ] Email értesítések (opcionális, SMTP alapon)
- [ ] Dashboard AI prioritás blokkok frissítése

## Sprint 5 – Agency Readiness + Monetizáció előkészítés

- [ ] Client switcher áthelyezése top barba (kereshető, legutóbbi kliensek)
- [ ] Workspace context vizuális jelzése
- [ ] Team permissions bővítése (csapatjogosultságok)
- [ ] Monetization-ready feature gating (Free / Pro / Agency szintek)
- [ ] Free tier limitek: 1 profil, limitált AI generálás, alap strategy
- [ ] Pro tier előkészítés: korlátlan AI, campaign builder, advanced analytics
- [ ] Agency tier előkészítés: multi-workspace, export, white-label előkészítés

## Hibajavítás – Auth session ütközés

- [x] appUserProcedure felismerje a Manus OAuth session-t (ctx.user) is
- [x] context.ts: ha app_token nincs de ctx.user megvan, auto-create/lookup appUser
- [x] Manus OAuth user és appUser tábla összekapcsolása (email alapján)
- [x] Super admin (g2amarketing) automatikusan super_admin role-t kapjon

## Hibajavítás – Landing CTA gombok

- [x] "Ingyenes próba" és "Kezdj el ingyen" gombok mindig /regisztracio-ra mutassanak
- [x] App.tsx: PublicOnlyRoute ne irányítsa át a /regisztracio oldalt (allowAuthenticated=true)

## Hibajavítás – Onboarding "Growth Engine indítása" gomb

- [x] Diagnosztizálni a hibát a "Működés" lépés befejezésekor
- [x] Javítani: completeOnboarding publicProcedure-ről appUserProcedure-re váltva (OAuth bridge támogatás)

## Hibajavítás – AI elemzés magyar nyelv

- [x] Onboarding AI elemzés prompt-ok átírása magyarra (brand DNA, stratégia, content pillérek)
- [x] Minden AI-generált tartalom magyar nyelven jelenjen meg

## Hibajavítás – AI elemzés stílus és form state szinkron

- [x] AI prompt: határozott, tényközlő stílus (nincs "valószínűleg", "lehet", "feltehetőleg")
- [x] OnboardingWizard: AI által kitöltött mezők (iparág, cég neve) frissítsék a form state-et

## Hibajavítás – "Growth Engine indítása" gomb hiba

- [x] Diagnosztizálni a generateIntelligence / generateWowMoment hiba okát
- [x] Javítani az onboarding utolsó lépésének hibáját

## Sprint 6 – Szerepkör alapú navigáció + Admin CRM + Tartalom Stúdió fejlesztés

### Navigáció jogosultság
- [x] "Új ügyfél" gomb a jobb felső sarokban csak super_admin-nak látható
- [x] "Ügyfelek" menüpont csak super_admin-nak látható
- [x] "Értékesítés" menüpont csak super_admin-nak látható
- [x] 404 hiba javítása az "Új ügyfél" gomb URL-jén

### Admin CRM panel
- [x] Admin CRM tábla: ügyfél neve, csomag, kontakt személy, weboldal, regisztráció dátuma, státusz
- [x] Szenzitív adatok (brand DNA, stratégia, tartalmak) nem láthatók admin nézetből
- [x] Admin CRM backend: getClientsCRM procedure (csak super_admin)
- [x] DB séma: subscription_plan, contactPerson, notes mezők az appUsers táblán

### Stratégia javítások
- [x] Company Intelligence ellenőrzés a stratégia generálás előtt
- [x] Ha nincs CI profil, irányítás az onboardingra / CI kitöltésére
- [x] Aktuális dátumok a stratégia generálásban (mai dátum alapján)

### Tartalom Stúdió fejlesztés
- [x] Stratégia-alapú tartalomjavaslatok (aktív stratégiából generálva)
- [x] Tartalomtípus ajánlók: poszt, email, blog, hirdetés – stratégia csatornák alapján
- [x] AI tartalom generálás szövegezéssel (tRPC procedure)
- [x] Szabad tartalom létrehozás segítséggel (témajavaslat, formátum, platform)
- [x] Tartalom Stúdió UX: "Stratégiából" és "Saját ötlet" fül szétválasztása

## Sprint 7 – WOW CTA-k, Content Pillérek, Admin CRM weboldal

### WOW screen CTA-k
- [x] "Stratégia generálása" gomb → /strategia route + stratégia generálás megnyítása
- [x] "Content Calendar feltöltése" gomb → /tartalom-studio route + Calendar tab
- [x] "Első email kampány indítása" gomb → /ertekesites route + Outbound tab

### Content pillérek mentése
- [x] OnboardingWizard: WOW screen content pillérek mentése clientProfiles.contentPillars-ba
- [x] profiles.upsert procedure: contentPillars mező frissítése a WOW adatokból

### Admin CRM weboldal mező
- [x] Admin CRM: weboldal mező a clientProfiles.website mezőből (nem appUsers-ből)
- [x] getClientsCRM procedure: JOIN clientProfiles-szal a weboldal adatért
