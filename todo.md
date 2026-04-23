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

## Sprint 8 – Auto-dialog, Dinamikus Pillérek, localStorage

### Stratégia auto-dialog
- [x] /strategia oldal: URL param vagy state alapán auto-megnyitás
- [x] Ha nincs aktív stratégia és from=onboarding param van, dialog automatikusan nyílik
- [x] WOW CTA "Stratégia" gomb: /strategia?autoGenerate=true URL-re navigál

### Content Stúdió dinamikus pillérek
- [x] "Javasolt" tab: mentett contentPillars lekérése az aktív profilból
- [x] Pillérek alapán dinamikus tartalomtípus kártyák generálása
- [x] Ha nincs mentett pillér, generikus kártyák maradnak fallback-ként

### Onboarding localStorage mentés
- [x] WizardData mentése localStorage-ba minden lépés után
- [x] Oldal betöltéskor localStorage-ból visszatöltés
- [x] Onboarding befejezésekor localStorage törlése

## Sprint 9 – Profil, Téma, Nyelv, Regisztráció, Pillérek, Összehasonlítás

### Profil dropdown
- [x] "Aktív ügyfél" váltó eltávolítása nem-admin felhasználóknál
- [x] Saját profil beállítások: felhasználónév szerkesztés, jelszó emlékeztető
- [x] Profil beállítások modal létrehozása a DashboardLayout-ban

### Téma és nyelv
- [x] Dark/light mode kapcsoló működővé tétele (ThemeProvider switchable=true)
- [x] Nyelvválasztó (HU/EN) vizualizáció javítása (az állapot váltódik, szövegek hardcoded)

### Regisztráció
- [x] Előfizetési opciók választó a regisztrációs folyamatban (Free, Starter, Pro)
- [x] register procedure: subscriptionPlan mező mentése

### Sprint 8 javaslatok
- [x] Onboarding visszatöltés banner: "Folytatod a korábbi kitöltést?" + törlés gomb
- [x] Content Stúdió pillér szűrés: pillérenként szűrés a kártyákon
- [x] Stratégia verzió összehasonlítás: két verzió egymás melletti nézete

## Sprint 10 – i18n, Dark/Light, Admin CRM, Üres állapotok, Képek, Animációk

### Nyelvi rendszer
- [x] i18n teljes körű implementálás: HU/EN fordítások főoldalon és regisztrációnál
- [x] Nyelvválasztó csak főoldalon és regisztrációnál látható
- [x] Regisztrációkor mentett nyelv alapján jelenik meg minden tartalom a dashboardban
- [x] Menüsor mindig látható (sticky/fixed)
- [x] Logo és "G2A Growth Engine" felirat kattintható, főoldalra navigál
- [x] Dark/light mode gomb a menüsorban (dashboard és főoldal)

### Admin CRM
- [x] Ügyfélváltáskor csak CRM adatok láthatók (nem a workspace)
- [x] CRM nézet: felhasználónév, cég, weboldal, kontakt, aktivitás, csomag

### Üres állapotok
- [x] Friss regisztrációnál üres dashboard (nincs fiktív adat)
- [x] Üres stratégia oldal (nincs fiktív adat)
- [x] Üres értékesítés oldal (nincs fiktív adat)
- [x] Üres analitika oldal (nincs fiktív adat)
- [x] Growth Engine főoldal: valid adatok (nincs fiktív kimutatás)

### Főoldal fejlesztés
- [x] Csomagajánlatok a főoldalon (azonos a regisztrációs oldallal)
- [x] Animációk: scroll-triggered, fade-in, slide-in effektek (framer-motion)
- [x] Hero szekció animáció

### Aloldalak képekkel
- [x] Releváns képek az aloldalakra (Analytics, ContentStudio)
- [x] Animációk az aloldalak UI elemeire (Dashboard, Strategy, Analytics, ContentStudio)

## Sprint 11 – Email, Feature Gating, Testimonials

### SMTP email integráció
- [x] Resend API integráció a szerveren
- [x] Jelszó-visszaállítás token generálás és DB mentés
- [x] Email küldés jelszó-visszaállítási linkkel (Resend API)
- [x] Jelszó-visszaállítás oldal (token validálás + új jelszó beállítás)
- [x] "Jelszó emlékeztető" gomb a profil dropdownban valódi emailt küld

### Feature gating
- [x] AI generálás számláló DB-ben (ai_usage tábla)
- [x] Free: 3 AI generálás/hó, Starter: 20/hó, Pro: korlátlan
- [x] Limit eléréskor upgrade prompt megjelenítése (profil dropdown + CTA)
- [x] Backend: checkAiUsageLimit + recordAiUsage helpers
- [x] Frontend: csomag badge + AI usage progress bar a profil dropdownban

### Főoldal testimonials
- [x] Testimonials szekció a pricing szekció alá
- [x] 3 ügyfélvélemény placeholder adatokkal (Kovács Péter, Nagy Eszter, Horváth Gábor)
- [x] Animált megjelenés (framer-motion FadeIn)

## Sprint 12 – Bug & UX javítások (teljes tesztelés alapján)

### 🔴 Kritikus bugok
- [ ] #1 OAuth-on bejelentkezett tulajdonos onboarding oldalra kerül (me procedure OAuth session kezelés)
- [ ] #2 Onboarding "Growth Engine indítása" örökre tölt lejárt session esetén (hiba kezelés + retry)
- [ ] #3 Iparág dropdown nem töltődik ki AI elemzés után (AI érték normalizálás a INDUSTRIES listához)
- [ ] #4 Dashboard gyorslinkek rossz/admin-only URL-re mutatnak

### 🟠 Közepes bugok
- [ ] #5 Elírás az AI limit hibaüzenetben ("Frítsítsd" → "Frissítsd")
- [ ] #6 Jelszó-visszaállítás URL hardkódolt régi domain-re (APP_URL env fallback)
- [ ] #7 AI limit hiba nem felhasználóbarát üzenetet ad (frontend nem jeleníti meg a részletes hibát)
- [ ] #8 Audit Log tab nem töltődik be adatokkal (Settings oldal nem hívja a procedure-t)
- [ ] #9 Admin eljárások publicProcedure-ként deklarálva (biztonsági javítás)

### 🟡 UX pain pointok
- [ ] #10 Nincs mobil sidebar (DashboardLayout responsive)
- [ ] #11 Intelligence, AI Íróeszköz, Profil oldal nem szerepel a sidebar navigációban
- [ ] #12 Értesítések hardkódolt placeholder adatokkal töltődnek be
- [ ] #13 Demo seed adatok minden új felhasználónál megjelennek (empty state javítás)
- [ ] #14 Regisztrációs oldalon nincs jelszó megerősítés mező
- [ ] #15 Beállítások Csapat és Audit Log tab-ok "hamarosan" jelölés nélkül
- [ ] #16 Nincs lazy loading / code splitting

## Sprint 12 – Bug & UX javítások (teljes tesztelés alapján)

### Kritikus bugok
- [x] #1 OAuth-on bejelentkezett tulajdonos az onboarding oldalra kerül – me procedure javítva (ctx.appUser fallback)
- [x] #2 Onboarding "Growth Engine indítása" gomb örökre tölt session lejárat esetén – timeout + retry gomb + session expiry üzenet
- [x] #3 Iparág dropdown nem töltődik ki AI elemzés után – normalizeIndustry fuzzy matching hozzáadva
- [x] #4 Dashboard gyorslinkek rossz URL-re mutatnak – /ertekesites AppRoute-ra javítva (volt AdminRoute)

### Közepes bugok
- [x] #5 Elírás "Frítsítsd" → "Frissítsd" a routers.ts AI limit üzenetekben (2 helyen)
- [x] #6 Hardkódolt APP_URL fallback a forgotPassword procedure-ben – dinamikus origin header (x-forwarded-host / host)
- [x] #7 AI limit hiba nem jelenik meg felhasználóbarát módon – Strategy és ContentStudio onError javítva upgrade CTA-val
- [x] #8 Audit Log tab üres volt – valódi DB adatok megjelenítése (trpc.auditLog.list)
- [x] #9 Admin procedure-ök cookie alapú auth helyett superAdminProcedure-t használnak (5 procedure javítva)

### UX pain pointok
- [x] #10 Mobil sidebar hiányzott – hamburger gomb + overlay + slide-in animáció DashboardLayout-ban
- [x] #11 Intelligence oldal nem volt a sidebar navigációban – hozzáadva Brain ikonnal
- [x] #12 Hardkódolt demo értesítések minden bejelentkezéskor – üres initial state ([] helyett demo adatok)
- [x] #13 Empty state a Sales Ops lead listán – informatívabb üzenet + "Első lead hozzáadása" CTA gomb
- [x] #14 Regisztrációs oldalon hiányzott a jelszó megerősítés mező – hozzáadva valós idejű egyezés validációval
- [x] #15 Settings Csapat tab nem jelezte, hogy "hamarosan" – sárga "Hamarosan" badge a tab fejlécben
- [x] #16 Nincs lazy loading – összes oldal (19 db) React.lazy() + Suspense-re átírva App.tsx-ben

## Sprint 13 – Fiktív adatok eltávolítása + Új funkciók

### Fiktív adatok cleanup
- [ ] Főoldal: testimonials szekció eltávolítása
- [ ] Főoldal: "200+ vállalkozás" trust indicator eltávolítása
- [ ] Főoldal: placeholder ügyféllogók eltávolítása (ha van)
- [ ] Admin panel: demo/seed ügyfelek eltávolítása
- [ ] DataContext: összes hardkódolt demo adat eltávolítása (leads, outbound, inbound)
- [ ] Dashboard: placeholder KPI adatok eltávolítása, valódi empty state-ek

### Onboarding Guided Mode (Express)
- [ ] Express útvonal gomb az onboarding első lépésén
- [ ] URL megadás → AI autofill → összes mező automatikus kitöltése
- [ ] Egyetlen "Megerősítés és indítás" gomb az Express módban
- [ ] Visszalépés lehetősége a részletes módba

### Dashboard "Mi a dolgom ma?" blokk
- [ ] AI-alapú napi prioritás lista generálása (stratégia + kampányok + leadek alapján)
- [ ] 3-5 konkrét teendő megjelenítése a dashboard tetején
- [ ] Teendők kipipálhatók (done state)
- [ ] Frissítés gomb (új AI generálás)

### Social media publikálás előkészítése
- [ ] Social accounts tábla a DB-ben (platform, accessToken, accountName)
- [ ] Settings > Integrációk tab: Facebook/Instagram és LinkedIn csatlakoztatás UI
- [ ] Content Studio: "Publikálás" gomb a tartalmakhoz
- [ ] OAuth flow előkészítése Meta és LinkedIn API-hoz

## Sprint 14 – CODEX.md implementálás

### EmptyState és AiLimitBanner komponensek
- [x] EmptyState komponens létrehozva (client/src/components/EmptyState.tsx)
- [x] AiLimitBanner komponens létrehozva (client/src/components/AiLimitBanner.tsx)
- [x] AiLimitBanner alkalmazva: ContentStudio, Strategy, Intelligence, Campaigns oldalakra
- [x] EmptyState alkalmazva: ContentStudio, Campaigns oldalakra

### Dashboard "Mi a dolgom ma?" blokk
- [x] dailyTasks.generate backend procedure hozzáadva (server/routers.ts)
- [x] DailyTasksBlock frontend komponens létrehozva (client/src/components/DailyTasksBlock.tsx)
- [x] DailyTasksBlock integrálva a Dashboard.tsx-be (KPI blokkok előtt)
- [x] Loading skeleton, motiváló üzenet, kategória badge-ek, navigációs linkek

### Navigáció és UX
- [x] Navigáció már 7 fő menüpontra egyszerűsítve (CODEX.md 9.1 alapján)
- [x] Tooltip-ek hozzáadva a navigációs ikonokhoz (shadcn/ui Tooltip)
- [x] Breadcrumb komponens létrehozva (client/src/components/Breadcrumb.tsx)

### Következő sprint (Sprint 15)
- [ ] Social media publikálás – DB séma: socialConnections + scheduledPosts táblák
- [ ] LinkedIn UGC Posts API integráció
- [ ] Content Studio publikálás panel
- [ ] DB-alapú értesítési rendszer (notifications tábla már létezik)
- [ ] Mobil UX javítások (kártya nézet, touch-friendly gombok)

## Sprint 15-16-17 – 2026-04-23

### Sprint 16 – DB-alapú értesítési rendszer
- [x] DashboardLayout notification dropdown valódi tRPC adatokra kötve (trpc.notifications.list)
- [x] useData() notifications placeholder eltávolítva, DB-ből tölt
- [x] Olvasottnak jelölés (markRead), összes olvasottnak jelölés (markAllRead) tRPC mutation-ök bekötve

### Sprint 15 – Social media publikálás
- [x] social_connections DB tábla létrehozva és migrálva (pnpm db:push)
- [x] scheduled_posts DB tábla létrehozva és migrálva
- [x] socialPublisher.ts helper – LinkedIn UGC Posts API integráció
- [x] social tRPC router: connections CRUD, schedulePost, publishNow, getScheduled
- [x] ContentStudio – Publikálás panel (platform kiválasztás, azonnali/ütemezett közzététel)
- [x] Settings > Integrációk tab – social fiók csatlakoztatás/kezelés valódi DB UI-val

### Sprint 17 – Mobil UX javítások
- [x] Leads oldal – mobil kártya nézet (md:hidden) + desktop tábla (hidden md:table)
- [x] SalesOps oldal – mobil kártya nézet + desktop tábla, touch-friendly 44px gombok

## Kritikus bug – Super admin AI limit bypass

- [x] checkAiUsageLimit: super_admin role esetén ne ellenőrizze a limitet (korlátlan AI)
- [x] recordAiUsage: super_admin esetén ne számolja a generálásokat
- [x] Frontend: super_admin-nál ne jelenjen meg az AI usage progress bar / upgrade prompt

## Sprint 18 – LinkedIn OAuth valódi flow
- [x] LinkedIn OAuth 2.0 app regisztráció dokumentálása
- [x] /api/oauth/linkedin/callback endpoint implementálása (server/linkedinOAuth.ts)
- [x] LinkedIn access token csere és DB mentés (social_connections tábla)
- [x] Settings > Integrációk: "Csatlakozás LinkedIn-nel" gomb valódi OAuth flow-val
- [x] social.getLinkedInOAuthUrl és social.isLinkedInConfigured tRPC procedure-ök
- [x] Settings oldal: OAuth callback URL paraméter kezelés (toast, URL cleanup)

## Sprint 19 – Onboarding Express mód
- [x] Express útvonal gomb az onboarding első lépésén (⚡ Express mód gomb)
- [x] URL megadás → AI autofill → összes mező automatikus kitöltése
- [x] Egyetlen "Megerősítés és indítás" gomb az Express módban (handleExpressFinish)
- [x] Visszalépés lehetősége a részletes módba

## Sprint 20 – Fiktív adatok teljes cleanup
- [x] Főoldal: testimonials szekció ellenőrizve – nincs fiktív adat (Landing.tsx)
- [x] Főoldal: "200+ vállalkozás" trust indicator ellenőrizve – nincs ilyen (Stats szekció valódi termékjellemzőket mutat)
- [x] Főoldal: placeholder ügyféllogók ellenőrizve – nincs ilyen
- [x] DataContext: összes hardkódolt demo adat eltávolítva – teljesen DB-alapú
- [x] Dashboard: placeholder KPI adatok eltávolítva, valódi empty state-ek implementálva

## Sprint 21 – SMTP email küldés (Resend integráció)
- [ ] Resend API integráció (server/emailSender.ts helper)
- [ ] outbound.send tRPC procedure (draft → tényleges küldés)
- [ ] SalesOps oldal: "Küldés" gomb az outbound email drawerben
- [ ] Email státusz frissítés: draft → sent (DB)
- [ ] Küldési hiba kezelés + toast üzenet
- [ ] Password reset email tényleges kiküldése Resend-del

## Sprint 22 – Analytics valódi adatok
- [ ] Analytics oldal: leads count chart (havi bontás, DB adatok)
- [ ] Analytics oldal: content volume chart (havi bontás, DB adatok)
- [ ] Analytics oldal: email sent/reply chart (havi bontás, DB adatok)
- [ ] Analytics tRPC procedure: getAnalyticsSummary (aggregált adatok)
- [ ] KPI kártyák valódi adatokkal (total leads, total content, total emails)
- [ ] Empty state kezelés ha nincs adat

## Sprint 23 – LinkedIn App setup + env var kezelés
- [ ] LinkedIn Developer App setup útmutató (Settings > Integrációk oldalon)
- [ ] LINKEDIN_CLIENT_ID és LINKEDIN_CLIENT_SECRET env var UI (Settings)
- [ ] LinkedIn kapcsolat státusz vizuális jelzése (konfigurált/nem konfigurált)
- [ ] Redirect URL megjelenítése a Settings oldalon (másolható)

## Sprint 21-22-23 – 2026-04-23

### Sprint 21 – Resend email küldés
- [x] sendOutboundEmail helper hozzáadva server/email.ts-hez (Resend API)
- [x] outbound.sendViaResend tRPC procedure implementálva
- [x] SalesOps: "Küldés Resend-del" gomb az outbound email szerkesztő modalban
- [x] Email státusz frissítés DB-ben küldés után (sent/failed)

### Sprint 22 – Analytics valódi adatok
- [x] Outbound email statisztikák (küldött/megnyitott/válaszolt) hozzáadva Analytics oldalhoz
- [x] Havi trend chart (leads + content) implementálva
- [x] Email analytics szekció az Analytics oldalon

### Sprint 23 – LinkedIn App setup + Admin panel
- [x] apiConfig tRPC router (superAdminProcedure): status, setLinkedInCredentials
- [x] Settings oldal: Admin tab hozzáadva (csak super_admin látja)
- [x] Admin tab: API konfiguráció állapot kártyák (LinkedIn, Resend)
- [x] Admin tab: LinkedIn OAuth credentials form (ideiglenes runtime beállítás)
- [x] Admin tab: LinkedIn App beállítási útmutató (lépésről lépésre)
- [x] BASE_TABS + ADMIN_TAB dinamikus tab lista (isSuperAdmin alapján)

## Onboarding-first flow + DailyTasks kattintható akciók – 2026-04-23

### Onboarding-first flow
- [ ] Első bejelentkezés után onboarding oldal fogadja a felhasználót (ne az irányítópult)
- [ ] Onboarding lépések: céges adatok → brand voice → arculat → célok → auto-generálás
- [ ] Intelligence auto-generálás az onboarding végén (brand DNA, stratégia, tartalmak)
- [ ] Ha már van profil és onboarding kész: irányítópult
- [ ] Onboarding progress perzisztálása (visszalépés után folytatás)

### DailyTasksBlock kattintható akciók
- [ ] Minden generált feladat kattintható legyen (navigáció + auto-trigger)
- [ ] "Stratégia-tervezet készítése" → Strategy oldal, stratégia generálás auto-trigger
- [ ] "Tartalom létrehozása" → Content Studio, generálás auto-trigger
- [ ] "Lead feldolgozás" → Sales Ops, leads tab
- [ ] Akció típus alapján routing logika (action_type mező a feladatokon)

## Sprint 24 – Subscription & Feature Gating
- [ ] Free/Pro/Agency szintek feature gate-jeinek implementálása
- [ ] AI limit per szint (Free: 3, Pro: 50, Agency: korlátlan)
- [ ] Profil limit per szint (Free: 1, Pro: 5, Agency: korlátlan)
- [ ] Kampány builder hozzáférés (Pro+)
- [ ] Upgrade prompt UI (feature lock overlay)

## Sprint 25 – Vitest tesztek
- [ ] Auth flow tesztek (register, login, logout, forgot-password)
- [ ] Adatizoláció tesztek (user csak saját profilját látja)
- [ ] Onboarding completion logika tesztje
- [ ] AI limit bypass tesztje (super_admin)
- [ ] Social connections CRUD tesztek

## Sprint 26 – TBD (következő sprint meghatározása implementálás után)

## Sprint 24-25-26 + Onboarding fixes – 2026-04-23

### Onboarding-first flow javítások
- [x] OnboardingWizard handleFinish: trpc.appAuth.me cache invalidálása completeOnboarding után
- [x] Express mód: szintén a handleFinish-en keresztül fejezi be az onboardingot (cache invalidálás örökli)
- [x] App.tsx AppRoute guard: onboardingCompleted=false → /onboarding redirect (megerősítve)

### DailyTasksBlock kattintható akciók
- [x] Backend: dailyTasks.generate procedure frissítve – actionType mező hozzáadva (navigate/generate/link)
- [x] Frontend: DailyTasksBlock újraírva – kattintható akciók, kategória badge-ek, navigáció + auto-trigger
- [x] Strategy oldal ?autoGenerate=true URL param kezelés megerősítve (már meglévő, működik)

### Sprint 24 – Subscription & Feature Gating
- [x] useSubscription hook létrehozva (client/src/hooks/useSubscription.ts)
- [x] UpgradePrompt komponens létrehozva (client/src/components/UpgradePrompt.tsx)
- [x] Strategy oldal: feature gate (starter+ szükséges)
- [x] Analytics oldal: feature gate (starter+ szükséges)
- [x] Campaigns oldal: feature gate (pro+ szükséges)

### Sprint 25 – Vitest tesztek
- [x] server/onboarding.test.ts: 26 teszt (onboarding state, role assignment, AI limit bypass, data isolation, subscription plans, auth context)
- [x] Összes teszt: 37/37 passed (4 test file)

### Sprint 26 – Kampány Builder kiegészítések
- [x] campaigns.generateContentFromBrief tRPC procedure (brief → Content Studio tartalmak)
- [x] Campaigns oldal: „Tartalmak automatikus létrehozása" gomb a brief tab-on
- [x] Campaigns oldal: feature gate (Pro csomag szükséges)

## Kritikus javítások + Sprint 27 – 2026-04-23

### Onboarding-first flow debug
- [ ] Diagnosztizálni miért nem irányít onboarding-ra az első belépés
- [ ] Tesztelési mód: logout után onboardingCompleted=false reset (dev/test célra)
- [ ] App.tsx AppRoute: onboardingCompleted=false → /onboarding redirect megerősítése

### UI cleanup
- [ ] Dark mode only: ThemeProvider defaultTheme="dark", light mode eltávolítása
- [ ] Témaváltó gomb eltávolítása a navigációból
- [ ] Nyelvválasztó eltávolítása (fordítások nincsenek kész)
- [ ] Profil switcher eltávolítása a jobb felső sarokból (minden user csak saját profilját éri el)
- [ ] DashboardLayout: profil switcher dropdown törlése
- [ ] Ügyfelek menüpont: csak super_admin látja
- [ ] Felhasználók kezelése menüpont: csak super_admin látja

### Sprint 27 – Content Calendar + Havi tartalom generálás
- [ ] Content Calendar nézet implementálása (havi naptár, drag-and-drop)
- [ ] Havi tartalom generálás: egy kattintásra 20-30 poszt generálása (LinkedIn, Facebook, Instagram)
- [ ] Generált tartalmak automatikusan megjelennek a naptárban scheduledAt dátummal
- [ ] Content Studio: "Havi tartalom generálása" gomb + konfiguráló modal

## Sprint 27 + UX javítások – 2026-04-23

- [x] Onboarding-first flow: appAuth.me cache invalidálás completeOnboarding után (OnboardingWizard)
- [x] Settings > Admin tab: Onboarding reset gomb teszteléshez (resetOnboardingForTesting procedure)
- [x] Dark mode only: ThemeProvider defaultTheme="dark" rögzítve, toggle eltávolítva
- [x] LanguageSwitcher eltávolítva DashboardLayout-ból és Landing.tsx-ből
- [x] Profil switcher eltávolítva DashboardLayout-ból (mindenki csak saját profilját érheti el)
- [x] Super_admin-only menüpontok: Ügyfelek és Felhasználók csak adminNavItems-ben
- [x] Sprint 27: content.generateMonthlyPlan backend procedure (12-16 AI poszt egy hónapra)
- [x] Sprint 27: "Teljes hónap AI-vel" gomb a Content Calendar fejlécében
- [x] Sprint 27: Havi terv tartalmak scheduledAt mezővel mentve a naptárba
