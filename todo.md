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
