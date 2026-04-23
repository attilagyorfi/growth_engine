# G2A Growth Engine – Codex Fejlesztési Útmutató

> **Cél:** Ez a dokumentum a G2A Growth Engine platform fejlesztési irányelveit, UX/UI mintáit és konkrét implementációs javaslatait tartalmazza. Célja, hogy minden fejlesztő, designer és termékmenedzser egységes referenciával rendelkezzen a platform felhasználóbarátságának és funkcionalitásának javításához.

**Verzió:** 1.0 | **Dátum:** 2026. április | **Célplatform:** G2A Growth Engine (React 19 + tRPC + Drizzle)

---

## Tartalomjegyzék

1. [Stratégiai kontextus](#1-stratégiai-kontextus)
2. [Inspirációs GitHub repók](#2-inspirációs-github-repók)
3. [Onboarding UX – A legfontosabb fejlesztési terület](#3-onboarding-ux)
4. [Empty State minták](#4-empty-state-minták)
5. [Dashboard UX – "Mi a dolgom ma?" blokk](#5-dashboard-ux)
6. [Progressive Disclosure – Fokozatos feltárás](#6-progressive-disclosure)
7. [AI generálás UX](#7-ai-generálás-ux)
8. [Mobil UX és reszponzivitás](#8-mobil-ux)
9. [Navigáció és információs architektúra](#9-navigáció)
10. [Social Media publikálás – Postiz minta alapján](#10-social-media-publikálás)
11. [Értesítési rendszer](#11-értesítési-rendszer)
12. [Prioritizált fejlesztési roadmap](#12-roadmap)
13. [Konkrét kód javaslatok](#13-kód-javaslatok)
14. [Referenciák](#14-referenciák)

---

## 1. Stratégiai kontextus

A G2A Growth Engine célja, hogy **KKV-k és egyéni vállalkozók külső segítség nélkül** kezeljék a teljes marketing és értékesítési folyamatukat. Ez a cél alapvetően meghatározza az összes UX döntést: a platform nem lehet "feature-rich és komplex" (HubSpot csapda), hanem **"kevés, de tökéletesen működő"** kell legyen.

A kutatás alapján a legfontosabb KKV-specifikus UX elvek:

- **Time-to-Value (TTV) minimalizálása:** A felhasználónak az első bejelentkezéstől számított 5 percen belül értéket kell kapnia. Canva ezt úgy oldja meg, hogy az első képernyőn már egy kész sablonból lehet dolgozni – nincs üres lap.
- **Kognitív terhelés csökkentése:** Egyszerre maximum 3-5 opció jelenjen meg. A KKV tulajdonos nem UX szakember, nem fogja végigolvasni az összes menüpontot.
- **Azonnali visszajelzés:** Minden AI generálás, mentés és módosítás után egyértelmű vizuális visszajelzés szükséges (toast, progress bar, konfetti).
- **Hibák emberi nyelven:** Soha ne jelenjen meg technikai hibaüzenet (pl. "FORBIDDEN", "500 Internal Server Error") – mindig fordítsd le emberi nyelvre.

---

## 2. Inspirációs GitHub repók

Az alábbi nyílt forráskódú projektek konkrét UI/UX mintákat és komponenseket kínálnak, amelyek közvetlenül adaptálhatók a G2A platformba.

### 2.1 Postiz App – Social Media Scheduling
**Repo:** [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) (29.3k ⭐)

A Postiz az egyik legjobb referencia a social media ütemezés UX-éhez. Főbb tanulságok a G2A számára:

| Postiz funkció | G2A adaptáció |
|---|---|
| Naptár nézet posztokhoz | Content Studio naptár nézet (heti/havi) |
| Platform-specifikus előnézet (Twitter, LinkedIn) | Poszt előnézet a Content Studioba |
| AI caption generálás | Már megvan, de UI-t javítani kell |
| Team collaboration | Jövőbeli funkció (Settings > Csapat) |
| Analytics per post | Content Analytics tab |

A Postiz technológiai stackje (NestJS + Prisma + Temporal) nem releváns, de a **UI flow** igen: a felhasználó kiválaszt egy platformot → megírja/generálja a szöveget → előnézetet lát → ütemezi. Ez a 4 lépéses flow a G2A Content Studioba is beépíthető.

### 2.2 Shadcn Admin Dashboard
**Repo:** [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) (magas ⭐)

A G2A már shadcn/ui-t használ, de ez a repo megmutatja, hogyan lehet a komponenseket **dashboard-specifikus layoutba** rendezni. Különösen hasznos minták:

- **Data Table** komponens szűrőkkel és rendezéssel (Leads, Campaigns oldalakhoz)
- **Command Palette** (Ctrl+K gyorskeresés) – power user funkció
- **Notification Dropdown** – a G2A értesítési rendszerének mintája
- **Breadcrumb navigáció** – aloldalakhoz (pl. Campaign > Részletek)

### 2.3 Awesome AI Marketing
**Repo:** [jmedia65/awesome-ai-marketing](https://github.com/jmedia65/awesome-ai-marketing)

Kurátor lista az AI marketing eszközökről és promptokról. A G2A Intelligence modul prompt könyvtárának bővítéséhez hasznos referencia. Különösen a **"when each one actually works"** megközelítés értékes: nem minden AI eszköz minden helyzetre alkalmas, és ezt a felhasználóval is kommunikálni kell.

### 2.4 Mautic – Open Source Marketing Automation
**Repo:** [mautic/mautic](https://github.com/mautic/mautic)

A világ legnagyobb nyílt forráskódú marketing automatizálási platformja. A G2A Campaigns moduljához releváns minták:
- **Email workflow builder** vizuális szerkesztővel
- **Lead scoring** rendszer
- **Szegmentáció** szabályok alapján

---

## 3. Onboarding UX

Az onboarding a **legkritikusabb konverziós pont**. A kutatás szerint a SaaS platformok 40-60%-a elveszíti a felhasználókat az első 7 napban, és ennek fő oka a rossz onboarding.

### 3.1 A jelenlegi állapot problémái

A G2A jelenlegi 5 lépéses wizard a következő problémákat mutatja:

1. **Túl sok mező egyszerre** – Az 1. lépésben 6 mező van (cégnév, weboldal, iparág, cégméret, leírás, kulcsszavak). Ez meghaladja a kognitív kapacitást.
2. **Az AI elemzés nem ad azonnali visszajelzést** – A felhasználó nem tudja, mi történik a háttérben.
3. **Nincs "skip" lehetőség** – Ha valakinek nincs weboldala, elakad.
4. **A "WOW kimenet" lépés az utolsó** – Az értéket a végén kapja a felhasználó, holott az elejére kellene.

### 3.2 Javasolt "Value-First" onboarding flow

A Formbricks és Canva mintájára a következő flow-t javasoljuk:

```
Lépés 0: Regisztráció (már megvan)
    ↓
Lépés 1: "Mi a vállalkozásod neve?" (1 mező)
    ↓
Lépés 2: "Van weboldalad?" (Igen → URL megadás + AI elemzés | Nem → kézi kitöltés)
    ↓
Lépés 3: AI azonnal generál egy mini stratégiát → "Íme az első javaslatod!" (WOW moment)
    ↓
Lépés 4: "Szeretnéd finomítani?" → Brand Voice, célok (opcionális, kihagyható)
    ↓
Dashboard (már van tartalom!)
```

**Kulcs különbség:** A WOW moment a 3. lépésben van, nem az 5.-ben. A felhasználó már az onboarding közben értéket kap.

### 3.3 Implementációs javaslatok

**Progressbar helyett lépésszámláló:**
```tsx
// Jelenlegi: "2/5" → Javasolt: "Még 2 perc és kész vagy!"
<div className="text-sm text-muted-foreground">
  {step === 1 && "1. lépés: Bemutatkozás (30 mp)"}
  {step === 2 && "2. lépés: AI elemzi a vállalkozásod (1 perc)"}
  {step === 3 && "3. lépés: Az első stratégiád kész! 🎉"}
</div>
```

**Skeleton loading az AI elemzés alatt:**
```tsx
// Ahelyett hogy "Elemzés folyamatban..." szöveget mutatunk:
{isAnalyzing && (
  <div className="space-y-3 animate-pulse">
    <div className="h-4 bg-muted rounded w-3/4" />
    <div className="h-4 bg-muted rounded w-1/2" />
    <div className="h-4 bg-muted rounded w-2/3" />
    <p className="text-sm text-muted-foreground mt-2">
      Az AI elemzi a weboldalad és összeállítja az első stratégiádat...
    </p>
  </div>
)}
```

**Hibakezelés session lejárat esetén:**
```tsx
// Ha az API 401-et dob az onboarding közben:
if (error.message.includes('Please login')) {
  toast.error('A munkamenet lejárt. Kérjük, jelentkezz be újra.', {
    action: { label: 'Bejelentkezés', onClick: () => navigate('/bejelentkezes') }
  });
}
```

---

## 4. Empty State minták

Az Eleken kutatása alapján az üres állapotok 3 típusa létezik, és mindegyiket másképp kell kezelni. A G2A jelenlegi implementációja sok helyen csak "Nincs adat" szöveget mutat.

### 4.1 Az üres állapotok típusai és G2A alkalmazásuk

| Típus | Mikor használd | G2A példa |
|---|---|---|
| **Informatív** | Első bejelentkezés, nincs még adat | Dashboard (nincs még stratégia) |
| **Akció-orientált** | Felhasználó tud valamit csinálni | Leads lista (+ Lead hozzáadása gomb) |
| **Ünneplő** | Minden feladat kész | Kampány sikeresen elküldve |

### 4.2 Konkrét empty state szövegek és komponensek

**Dashboard – nincs stratégia:**
```tsx
<EmptyState
  icon={<Sparkles className="w-12 h-12 text-muted-foreground" />}
  title="Még nincs stratégiád"
  description="Az AI 2 perc alatt összeállítja az első növekedési stratégiádat a vállalkozásod alapján."
  action={
    <Button onClick={() => navigate('/strategia')}>
      <Sparkles className="w-4 h-4 mr-2" />
      Stratégia generálása
    </Button>
  }
/>
```

**Leads lista – nincs lead:**
```tsx
<EmptyState
  icon={<Users className="w-12 h-12 text-muted-foreground" />}
  title="Még nincs egyetlen leadod sem"
  description="Adj hozzá potenciális ügyfeleket manuálisan, vagy importáld őket CSV fájlból."
  action={
    <div className="flex gap-2">
      <Button onClick={openAddLeadModal}>+ Lead hozzáadása</Button>
      <Button variant="outline" onClick={openImportModal}>CSV importálás</Button>
    </div>
  }
/>
```

**Content Studio – nincs tartalom:**
```tsx
<EmptyState
  icon={<FileText className="w-12 h-12 text-muted-foreground" />}
  title="Még nincs létrehozott tartalmad"
  description="Generálj AI-vel LinkedIn posztot, email kampányt vagy blog cikket – percek alatt."
  action={<Button onClick={openGenerateModal}><Wand2 className="w-4 h-4 mr-2" />Tartalom generálása</Button>}
/>
```

### 4.3 Újrafelhasználható EmptyState komponens

A G2A-ban létre kell hozni egy `client/src/components/EmptyState.tsx` komponenst:

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4 text-center",
      className
    )}>
      {icon && <div className="mb-4 opacity-50">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
```

---

## 5. Dashboard UX – "Mi a dolgom ma?" blokk

A kutatás alapján a legjobb SaaS dashboardok **nem mutatnak mindent egyszerre**, hanem egy egyértelmű "következő lépés" blokkot helyeznek a tetejére. A Linear és a Notion ezt "Today's Focus" vagy "Inbox" névvel oldja meg.

### 5.1 Backend procedure (server/routers.ts)

```typescript
// Hozzáadandó a routers.ts-be:
dailyTasks: appUserProcedure
  .input(z.object({ profileId: z.string() }))
  .query(async ({ ctx, input }) => {
    const profile = await getProfileById(input.profileId);
    const recentLeads = await getLeadsByProfile(input.profileId, { limit: 3, status: 'new' });
    const pendingContent = await getContentByProfile(input.profileId, { status: 'draft', limit: 2 });
    const hasStrategy = await hasStrategyForProfile(input.profileId);
    
    const tasks: DailyTask[] = [];
    
    if (!hasStrategy) {
      tasks.push({
        id: 'generate-strategy',
        priority: 'high',
        title: 'Generáld az első stratégiádat',
        description: 'Az AI 2 perc alatt összeállítja a növekedési tervedet',
        action: '/strategia',
        icon: 'sparkles',
      });
    }
    
    recentLeads.forEach(lead => {
      tasks.push({
        id: `follow-up-${lead.id}`,
        priority: 'medium',
        title: `Kövesd fel: ${lead.name}`,
        description: `${lead.company} – ${lead.status} státusz`,
        action: `/ertekesites?leadId=${lead.id}`,
        icon: 'user',
      });
    });
    
    pendingContent.forEach(content => {
      tasks.push({
        id: `publish-${content.id}`,
        priority: 'low',
        title: `Tedd közzé: ${content.title}`,
        description: 'Vázlat állapotban van',
        action: `/tartalom-studio?contentId=${content.id}`,
        icon: 'file-text',
      });
    });
    
    return tasks.slice(0, 5); // Max 5 feladat
  }),
```

### 5.2 Frontend komponens (Dashboard.tsx)

```tsx
// Hozzáadandó a Dashboard.tsx elejére:
const { data: dailyTasks, isLoading: tasksLoading } = trpc.dailyTasks.useQuery(
  { profileId: activeProfile.id },
  { enabled: !!activeProfile.id }
);

// A render-ben:
{dailyTasks && dailyTasks.length > 0 && (
  <Card className="border-primary/20 bg-primary/5 mb-6">
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Sun className="w-4 h-4 text-primary" />
        Mi a dolgod ma?
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {dailyTasks.map(task => (
        <Link key={task.id} to={task.action}>
          <div className="flex items-center gap-3 p-2 rounded-md hover:bg-background/50 transition-colors cursor-pointer">
            <div className={cn("w-2 h-2 rounded-full", {
              'bg-red-500': task.priority === 'high',
              'bg-yellow-500': task.priority === 'medium',
              'bg-blue-500': task.priority === 'low',
            })} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <p className="text-xs text-muted-foreground truncate">{task.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>
        </Link>
      ))}
    </CardContent>
  </Card>
)}
```

---

## 6. Progressive Disclosure – Fokozatos feltárás

A progressive disclosure az a technika, amely **fokozatosan tárja fel a komplexitást** ahelyett, hogy mindent egyszerre mutatna. Ez a KKV felhasználók számára különösen fontos, mert ők általában nem UX szakemberek.

### 6.1 Alkalmazási területek a G2A-ban

**Intelligence oldal – Haladó beállítások elrejtése:**
```tsx
// Jelenlegi: minden beállítás látható
// Javasolt: "Haladó beállítások" összecsukható szekció

<Collapsible>
  <CollapsibleTrigger asChild>
    <Button variant="ghost" size="sm" className="text-muted-foreground">
      <Settings2 className="w-3 h-3 mr-1" />
      Haladó beállítások
      <ChevronDown className="w-3 h-3 ml-1" />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="mt-3 space-y-3 border-t pt-3">
    {/* Tone, language, format beállítások */}
  </CollapsibleContent>
</Collapsible>
```

**Content Studio – Platform-specifikus mezők:**
```tsx
// Csak a kiválasztott platform mezőit mutasd:
{selectedPlatform === 'linkedin' && (
  <div className="space-y-2">
    <Label>Hashtag-ek (max 5)</Label>
    <Input placeholder="#marketing #kkv #növekedés" />
  </div>
)}
{selectedPlatform === 'email' && (
  <div className="space-y-2">
    <Label>Email tárgya</Label>
    <Input placeholder="Pl. 3 tipp, amivel 30%-kal több leadet szerezhetsz" />
  </div>
)}
```

**Settings – Tabonkénti feltárás:**
Az összetett beállítások (Brand, Integrations, Team, Billing) legyenek tabokba rendezve, és minden tab csak a saját tartalmát töltse be (lazy loading).

### 6.2 Tooltip rendszer

Minden nem egyértelmű UI elem mellé kerüljön egy `?` ikon tooltippal:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

// Használat:
<div className="flex items-center gap-1">
  <Label>AI generálási limit</Label>
  <Tooltip>
    <TooltipTrigger asChild>
      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent>
      <p className="max-w-xs text-xs">
        A Free csomag 3 AI generálást tartalmaz havonta. 
        A Starter csomaggal 20-at, a Pro-val korlátlan generálást kapsz.
      </p>
    </TooltipContent>
  </Tooltip>
</div>
```

---

## 7. AI generálás UX

Az AI generálás a platform legfontosabb értékajánlata, ezért különös figyelmet érdemel a UX.

### 7.1 Streaming válaszok megjelenítése

Jelenleg az AI generálás "mindent egyszerre" mutat. A jobb UX a **streaming megjelenítés** (mint a ChatGPT):

```tsx
// A streamdown könyvtár már telepítve van:
import { Streamdown } from 'streamdown';

// Streaming állapot kezelése:
const [streamContent, setStreamContent] = useState('');
const [isStreaming, setIsStreaming] = useState(false);

// A generált tartalmat karakterenként jelenítsd meg:
<div className="relative">
  <Streamdown className="prose prose-sm max-w-none">{streamContent}</Streamdown>
  {isStreaming && (
    <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5" />
  )}
</div>
```

### 7.2 Generálás közbeni UX

```tsx
// Generálás gomb állapotai:
<Button 
  onClick={handleGenerate}
  disabled={isGenerating}
  className="relative"
>
  {isGenerating ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Generálás... ({Math.round(progress)}%)
    </>
  ) : (
    <>
      <Sparkles className="w-4 h-4 mr-2" />
      AI Generálás
    </>
  )}
</Button>

// Progress bar a generálás alatt:
{isGenerating && (
  <Progress value={progress} className="h-1 mt-2" />
)}
```

### 7.3 Generált tartalom műveletek

Minden generált tartalom után azonnal jelenjenek meg a műveleti gombok:

```tsx
{generatedContent && (
  <div className="flex gap-2 mt-3 flex-wrap">
    <Button size="sm" onClick={handleCopy}>
      <Copy className="w-3 h-3 mr-1" /> Másolás
    </Button>
    <Button size="sm" variant="outline" onClick={handleRegenerate}>
      <RefreshCw className="w-3 h-3 mr-1" /> Újragenerálás
    </Button>
    <Button size="sm" variant="outline" onClick={handleSave}>
      <Save className="w-3 h-3 mr-1" /> Mentés
    </Button>
    <Button size="sm" variant="outline" onClick={handleSchedule}>
      <Calendar className="w-3 h-3 mr-1" /> Ütemezés
    </Button>
  </div>
)}
```

### 7.4 AI limit UX javítás

A limit elérése ne csak toast-ban jelenjen meg, hanem egy **inline banner** is:

```tsx
// Minden AI-t használó oldalon (Intelligence, Strategy, ContentStudio):
{aiUsage && aiUsage.remaining === 0 && (
  <Alert className="border-destructive/50 bg-destructive/5 mb-4">
    <AlertCircle className="h-4 w-4 text-destructive" />
    <AlertTitle>Elérted a havi AI limitedet</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>A Free csomag 3 generálást tartalmaz havonta.</span>
      <Button size="sm" variant="destructive" onClick={() => navigate('/regisztracio?upgrade=true')}>
        Csomag frissítése
      </Button>
    </AlertDescription>
  </Alert>
)}

{aiUsage && aiUsage.remaining > 0 && aiUsage.remaining <= 1 && (
  <Alert className="border-yellow-500/50 bg-yellow-500/5 mb-4">
    <AlertCircle className="h-4 w-4 text-yellow-600" />
    <AlertDescription>
      Csak <strong>{aiUsage.remaining} AI generálásod</strong> maradt ebben a hónapban.
    </AlertDescription>
  </Alert>
)}
```

---

## 8. Mobil UX és reszponzivitás

A KKV tulajdonosok jelentős része mobilon is használja az eszközöket. A jelenlegi implementáció alapvetően desktop-first.

### 8.1 Sidebar javítás (már részben megvan)

A Sprint 12-ben implementált hamburger menü mellé a következő javítások szükségesek:

```tsx
// Sidebar overlay kattintásra záródjon be:
{sidebarOpen && (
  <div 
    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
    onClick={() => setSidebarOpen(false)}
  />
)}

// Sidebar navigációs linkek kattintásra záródjanak be mobilon:
const handleNavClick = () => {
  if (window.innerWidth < 1024) {
    setSidebarOpen(false);
  }
};
```

### 8.2 Táblázatok mobilon

A Leads, Campaigns és Content táblázatok mobilon nem olvashatók. Javasolt megoldás: **kártya nézet mobilon, táblázat desktopon**:

```tsx
// Responsive lista/kártya váltás:
<div className="hidden md:block">
  <DataTable columns={columns} data={leads} />
</div>
<div className="md:hidden space-y-3">
  {leads.map(lead => (
    <Card key={lead.id} className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{lead.name}</p>
          <p className="text-sm text-muted-foreground">{lead.company}</p>
        </div>
        <Badge variant={lead.status === 'hot' ? 'destructive' : 'secondary'}>
          {lead.status}
        </Badge>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" className="flex-1">Részletek</Button>
        <Button size="sm" className="flex-1">Követés</Button>
      </div>
    </Card>
  ))}
</div>
```

### 8.3 Touch-friendly gombok

Mobilon minden interaktív elem legalább **44x44px** legyen (Apple HIG szabvány):

```tsx
// Táblázat akció gombok mobilon:
<Button size="sm" className="min-h-[44px] min-w-[44px]">
  <MoreHorizontal className="w-4 h-4" />
</Button>
```

---

## 9. Navigáció és információs architektúra

### 9.1 Jelenlegi navigációs problémák

A sidebar jelenleg 15+ menüpontot tartalmaz, ami túl sok. A KKV felhasználók számára maximum 7±2 menüpont ajánlott (Miller's Law).

**Javasolt navigációs struktúra:**

```
📊 Irányítópult          ← Mindig első
🧠 AI Asszisztens        ← Intelligence + Strategy összevonva
✍️ Tartalom              ← Content Studio
👥 Ügyfelek              ← Leads + Outbound összevonva  
📧 Kampányok             ← Campaigns
📈 Analitika             ← Analytics
⚙️ Beállítások           ← Settings
```

Ez 7 főmenüpont, ami ideális. A jelenlegi 12+ menüpont csökkentése a legfontosabb navigációs fejlesztés.

### 9.2 Breadcrumb navigáció aloldalakhoz

Minden aloldalon (pl. Campaign részletek, Lead profil) legyen breadcrumb:

```tsx
// client/src/components/Breadcrumb.tsx
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="w-3 h-3" />}
          {item.href ? (
            <Link to={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
```

### 9.3 Command Palette (Ctrl+K)

A power user-ek számára egy gyorskeresés/parancs paletta:

```tsx
// Implementáció: cmdk könyvtár (már kompatibilis shadcn-nel)
// pnpm add cmdk

import { Command } from "cmdk";

// Globális Ctrl+K shortcut:
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setCommandOpen(true);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## 10. Social Media publikálás – Postiz minta alapján

A social media direkt publikálás a platform legfontosabb "ragasztó" funkciója. A Postiz repó alapján a következő architektúra javasolt.

### 10.1 Adatbázis séma kiegészítés

```typescript
// drizzle/schema.ts kiegészítés:
export const socialConnections = mysqlTable('social_connections', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: varchar('profile_id', { length: 36 }).notNull(),
  platform: mysqlEnum('platform', ['facebook', 'instagram', 'linkedin', 'twitter']).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: bigint('token_expires_at', { mode: 'number' }),
  platformUserId: varchar('platform_user_id', { length: 255 }),
  platformUsername: varchar('platform_username', { length: 255 }),
  isActive: boolean('is_active').default(true),
  createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
});

export const scheduledPosts = mysqlTable('scheduled_posts', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  profileId: varchar('profile_id', { length: 36 }).notNull(),
  contentId: varchar('content_id', { length: 36 }),
  platform: mysqlEnum('platform', ['facebook', 'instagram', 'linkedin', 'twitter']).notNull(),
  text: text('text').notNull(),
  imageUrl: text('image_url'),
  scheduledAt: bigint('scheduled_at', { mode: 'number' }).notNull(),
  status: mysqlEnum('status', ['pending', 'published', 'failed']).default('pending'),
  publishedAt: bigint('published_at', { mode: 'number' }),
  errorMessage: text('error_message'),
  createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
});
```

### 10.2 LinkedIn API integráció (legegyszerűbb kezdőpont)

A LinkedIn API a legegyszerűbb a KKV célcsoporthoz, mert:
- Nincs app review folyamat (ellentétben a Meta-val)
- A LinkedIn UGC Posts API nyilvánosan elérhető
- A KKV B2B célcsoportja elsősorban LinkedIn-en van

```typescript
// server/socialPublisher.ts
export async function publishToLinkedIn(
  accessToken: string,
  authorId: string,
  text: string,
  imageUrl?: string
): Promise<{ postId: string }> {
  const body = {
    author: `urn:li:person:${authorId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
        ...(imageUrl && {
          media: [{
            status: 'READY',
            originalUrl: imageUrl,
          }]
        })
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn API error: ${response.status}`);
  }

  const data = await response.json();
  return { postId: data.id };
}
```

### 10.3 Content Studio "Publikálás" gomb

```tsx
// A generált tartalom után megjelenő publikálási panel:
{generatedContent && connectedPlatforms.length > 0 && (
  <Card className="mt-4">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm">Közzététel</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {connectedPlatforms.map(platform => (
          <Button
            key={platform.id}
            variant={selectedPlatforms.includes(platform.id) ? 'default' : 'outline'}
            size="sm"
            onClick={() => togglePlatform(platform.id)}
          >
            <PlatformIcon platform={platform.platform} className="w-4 h-4 mr-1" />
            {platform.platformUsername}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button onClick={handlePublishNow} disabled={selectedPlatforms.length === 0}>
          <Send className="w-4 h-4 mr-2" />
          Közzététel most
        </Button>
        <Button variant="outline" onClick={handleSchedule} disabled={selectedPlatforms.length === 0}>
          <Calendar className="w-4 h-4 mr-2" />
          Ütemezés
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

## 11. Értesítési rendszer

A jelenlegi értesítési rendszer in-memory állapotban van (DataContext). Valódi DB-alapú értesítési rendszer szükséges.

### 11.1 Adatbázis séma

```typescript
// drizzle/schema.ts kiegészítés:
export const appNotifications = mysqlTable('app_notifications', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id', { length: 36 }).notNull(),
  profileId: varchar('profile_id', { length: 36 }),
  type: mysqlEnum('type', ['info', 'success', 'warning', 'error', 'ai_complete', 'lead_new']).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message'),
  link: varchar('link', { length: 500 }),
  isRead: boolean('is_read').default(false),
  createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
});
```

### 11.2 Automatikus értesítések

Az alábbi eseményeknél automatikusan kell értesítést létrehozni:

| Esemény | Értesítés típusa | Szöveg |
|---|---|---|
| AI generálás kész | `ai_complete` | "A stratégiád elkészült! Kattints a megtekintéshez." |
| Új lead hozzáadva | `lead_new` | "Új lead: {name} – {company}" |
| Kampány elküldve | `success` | "A kampányod sikeresen elküldve {X} címzettnek" |
| AI limit 80%-on | `warning` | "Csak {X} AI generálásod maradt ebben a hónapban" |
| Jelszó megváltoztatva | `info` | "A jelszavad sikeresen megváltozott" |

---

## 12. Prioritizált fejlesztési roadmap

Az összes kutatás és elemzés alapján a következő prioritizált fejlesztési sorrendet javasoljuk:

### Sprint 14 – Alapvető UX javítások (2 hét)

| Feladat | Prioritás | Komplexitás | Hatás |
|---|---|---|---|
| EmptyState komponens létrehozása és alkalmazása minden oldalon | Kritikus | Alacsony | Magas |
| Dashboard "Mi a dolgom ma?" blokk | Magas | Közepes | Nagyon magas |
| AI generálás inline limit banner | Magas | Alacsony | Magas |
| Navigáció egyszerűsítése (12 → 7 menüpont) | Magas | Közepes | Magas |
| Tooltip rendszer bevezetése | Közepes | Alacsony | Közepes |

### Sprint 15 – Social Media publikálás (3 hét)

| Feladat | Prioritás | Komplexitás | Hatás |
|---|---|---|---|
| LinkedIn OAuth integráció | Kritikus | Magas | Nagyon magas |
| scheduledPosts DB tábla és API | Magas | Közepes | Magas |
| Content Studio publikálás panel | Magas | Közepes | Nagyon magas |
| Poszt ütemező naptár nézet | Közepes | Magas | Magas |

### Sprint 16 – Értesítések és engagement (2 hét)

| Feladat | Prioritás | Komplexitás | Hatás |
|---|---|---|---|
| DB-alapú értesítési rendszer | Magas | Közepes | Magas |
| Automatikus értesítések AI eseményekre | Közepes | Alacsony | Közepes |
| Command Palette (Ctrl+K) | Alacsony | Közepes | Közepes |
| Onboarding Value-First flow átírása | Magas | Magas | Nagyon magas |

### Sprint 17 – Mobil és teljesítmény (2 hét)

| Feladat | Prioritás | Komplexitás | Hatás |
|---|---|---|---|
| Kártya nézet mobilon (táblázatok helyett) | Magas | Közepes | Magas |
| Touch-friendly gombok (44px min) | Közepes | Alacsony | Közepes |
| Virtualizált listák (react-virtual) | Alacsony | Közepes | Közepes |

---

## 13. Konkrét kód javaslatok

### 13.1 Telepítendő csomagok

```bash
# UX javításokhoz:
pnpm add cmdk                    # Command Palette
pnpm add react-hot-toast         # Jobb toast értesítések (ha váltani akarunk)
pnpm add @radix-ui/react-tooltip # Tooltip (már megvan shadcn-nel)
pnpm add framer-motion           # Animációk (már telepítve)

# Social media publikáláshoz:
pnpm add linkedin-api-client     # LinkedIn API wrapper (opcionális)
```

### 13.2 Fájlstruktúra kiegészítések

```
client/src/
  components/
    EmptyState.tsx          ← Újrafelhasználható üres állapot komponens
    Breadcrumb.tsx          ← Breadcrumb navigáció
    CommandPalette.tsx      ← Ctrl+K gyorskeresés
    PlatformIcon.tsx        ← Social media platform ikonok
    AiLimitBanner.tsx       ← AI limit figyelmeztető banner
  hooks/
    useAiUsage.ts           ← AI használat hook (useQuery wrapper)
    useCommandPalette.ts    ← Command palette state hook
  pages/
    SocialConnect.tsx       ← Social media kapcsolatok kezelése
    PostScheduler.tsx       ← Poszt ütemező naptár
server/
  socialPublisher.ts        ← LinkedIn/Meta API integráció
  routers/
    social.ts               ← Social media tRPC router
    notifications.ts        ← Értesítési tRPC router
drizzle/
  schema.ts                 ← socialConnections, scheduledPosts, appNotifications táblák
```

### 13.3 Globális UX szabályok a kódban

Az alábbi szabályokat minden fejlesztőnek be kell tartania:

```typescript
// 1. Soha ne jelenjen meg technikai hibaüzenet:
// ❌ Rossz:
toast.error(error.message); // "FORBIDDEN" vagy "500 Internal Server Error"

// ✅ Jó:
const getHumanError = (error: unknown): string => {
  if (error instanceof TRPCClientError) {
    if (error.message.includes('FORBIDDEN')) return 'Nincs jogosultságod ehhez a művelethez.';
    if (error.message.includes('limit')) return 'Elérted a havi AI limitedet. Frissítsd a csomagodat!';
    if (error.message.includes('Please login')) return 'A munkamenet lejárt. Kérjük, jelentkezz be újra.';
  }
  return 'Valami hiba történt. Kérjük, próbáld újra.';
};
toast.error(getHumanError(error));

// 2. Minden mutáció után invalidálj:
const mutation = trpc.leads.create.useMutation({
  onSuccess: () => {
    utils.leads.list.invalidate();
    toast.success('Lead sikeresen hozzáadva!');
  },
  onError: (error) => toast.error(getHumanError(error)),
});

// 3. Minden lista query legyen enabled guard-dal:
const { data } = trpc.leads.list.useQuery(
  { profileId: activeProfile.id },
  { enabled: !!activeProfile.id } // ← Kötelező!
);
```

---

## 14. Referenciák

[1] Postiz – Open Source Social Media Scheduling Tool: https://github.com/gitroomhq/postiz-app

[2] Shadcn Admin Dashboard: https://github.com/satnaing/shadcn-admin

[3] Awesome AI Marketing: https://github.com/jmedia65/awesome-ai-marketing

[4] Mautic – Open Source Marketing Automation: https://github.com/mautic/mautic

[5] 7 User Onboarding Best Practices for 2026 – Formbricks: https://formbricks.com/blog/user-onboarding-best-practices

[6] Empty State UX: Real-world examples and design rules – Eleken: https://www.eleken.co/blog-posts/empty-state-ux

[7] Progressive Disclosure in AI-Powered Product Design – UX Planet: https://uxplanet.org/progressive-disclosure-in-ai-powered-product-design-978da0aaeb08

[8] SMB Enablement: Simplified Onboarding & Flexible Pricing – Medium: https://merfantz.medium.com/smb-enablement-simplified-onboarding-flexible-pricing-d920e0b25d8b

[9] The Ultimate SaaS UI Checklist: 10 Design Mistakes to Avoid – Exalt Studio: https://exalt-studio.com/blog/the-ultimate-saas-ui-checklist-10-design-mistakes-to-avoid

[10] Designing for Nothing: The Invisible UX of Empty States – Medium: https://medium.com/design-bootcamp/designing-for-nothing-the-invisible-ux-of-empty-states-bc3a72ca31f5

[11] LinkedIn UGC Posts API Documentation: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api

[12] Intercom Product Tours – Onboarding Best Practices: https://www.intercom.com/blog/product-tours-first-use-onboarding/

---

*Dokumentum készítette: Manus AI | G2A Growth Engine fejlesztési csapat számára | 2026. április*
