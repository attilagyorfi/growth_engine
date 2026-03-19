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
