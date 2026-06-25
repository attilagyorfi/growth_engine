# Közösségi média OAuth — setup útmutató (magyar)

A G2A Growth Engine 4 közösségi média platformhoz tud csatlakozni: **LinkedIn**,
**Facebook**, **Instagram**, **TikTok**. Az OAuth flow kódja kész és deployolva
van — viszont **mindegyik platformhoz külön Developer App-ot kell regisztrálnod**
a megfelelő szolgáltatónál, és **App Review-t kell kérned** a publishing
permission-ökre. Ez 2-4 hetet vehet igénybe platformonként.

Ez a doc lépésről lépésre végigvezet a teljes folyamaton.

> **Megjegyzés**: az itt szereplő linkek és UI-elemek 2026-ban érvényesek.
> A Meta és TikTok Developer Portal-ja rendszeresen változik. Ha valami nem
> stimmel, keresd a "Meta Login for Business setup" vagy "TikTok login kit"
> 2026-os tutorial-okat.

---

## 1. Általános előfeltételek

A 3 platformhoz közös:

- **Production domain**: `https://growthengine-production.up.railway.app`
  (vagy a saját domained, ha custom-domain-t kötöttél a Railway-hez)
- **Privacy Policy URL**: a meglévő `/adatvedelem` oldal jó (`https://[domain]/adatvedelem`)
- **Terms of Service URL**: jelenleg **NINCS** — készíteni kell egy
  `/aszf` vagy `/terms` oldalt (lásd a végén lévő mintát)
- **App ikon**: 1024×1024 PNG (a G2A logo `client/public/brand/mark-blue.png` is használható, esetleg háttérrel kibővítve)
- **Demo videó** (csak a Meta-hoz): 1-3 perces képernyőfelvétel arról, hogyan
  csatlakozik egy user a saját FB Page-ét és hogyan publikál egy posztot
  (Loom + OBS jó eszközök)

---

## 2. LinkedIn (✅ már működik)

A LinkedIn App már létrehozva és **NEM igényel App Review**-t az `openid`,
`profile`, `email`, `w_member_social` scope-okhoz. A Railway env-ben már be van
állítva: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.

Nincs további teendő. A user a Beállítások → Integrációk → LinkedIn gombbal
csatlakozhat.

---

## 3. Facebook + Instagram (közös Meta App)

A Meta egy App-pal lefedi a Facebook Page-eket ÉS az Instagram Business
accountokat. Az IG csak FB Page-en keresztül érhető el.

### 3.1 Meta Developer fiók

1. Menj a [https://developers.facebook.com](https://developers.facebook.com)-ra
2. **Get Started** (jobb felső)
3. **Continue as [neved]** — az info@g2amarketing.hu accounthoz tartozó FB fiókkal
4. Kérdéseknél válaszd: **I'm a developer** / **Business** / **Marketing & advertising**
5. Megerősítő email + telefonszám-verifikáció

### 3.2 Új App létrehozása

1. **My Apps** → **Create App**
2. **Use case**: válaszd **"Other"** → **Next**
3. **App type**: válaszd **"Business"** → **Next**
4. **App name**: `G2A Growth Engine`
5. **Contact email**: `info@g2amarketing.hu`
6. **Business Account**: ha van, válaszd ki; ha nincs, hozz létre egyet
   ("G2A Marketing")
7. **Create App**

### 3.3 App Dashboard beállítások

A Dashboard-on:

1. **App ID** és **App Secret** (Settings → Basic) → ezek lesznek a Railway env-ek:
   - `FACEBOOK_APP_ID` = App ID
   - `FACEBOOK_APP_SECRET` = App Secret (kattints **Show**, jelszó kell hozzá)
2. **Settings → Basic**:
   - **App Icon**: töltsd fel a `mark-blue.png`-t (1024×1024-ra resize-eold előtte)
   - **Privacy Policy URL**: `https://growthengine-production.up.railway.app/adatvedelem`
   - **Terms of Service URL**: `https://growthengine-production.up.railway.app/aszf` (létrehozni kell)
   - **App domains**: `growthengine-production.up.railway.app`
   - **Category**: "Business and Pages"
3. **Settings → Basic** alján: **Save Changes**

### 3.4 Termékek hozzáadása

A bal oldali menüben **Products** → **Add Product**:

1. **Facebook Login for Business** → **Set Up**
   - **Client OAuth Settings**: **Yes** mindenhol
   - **Valid OAuth Redirect URIs**:
     `https://growthengine-production.up.railway.app/api/oauth/facebook/callback`
   - **Save changes**
2. **Marketing API** → **Set Up** (csak megnyitni elég, nem kell konfigurálni)
3. **Instagram Graph API** → **Set Up** (automatikus, ha "Business" account a Page-en)

### 3.5 App Review

Ezek a permission-ök **csak Review után** működnek production-ban (Development
mode-ban csak a fejlesztő és test user-ek tudnak bejelentkezni):

| Permission | Mit ad | Indoklás (review-hoz) |
|------------|--------|----------------------|
| `pages_show_list` | Page-ek listája | "Show user their connected Facebook Pages so they can select which Page to publish to" |
| `pages_manage_posts` | Page-ek poszt publikálás | "Allow user to schedule and publish AI-generated marketing content to their Facebook Page" |
| `pages_read_engagement` | Page analytics (későbbi feature-höz) | "Display post performance metrics in the Analytics dashboard" |
| `instagram_basic` | IG Business account info | "Connect Instagram Business account linked to user's Facebook Page" |
| `instagram_content_publish` | IG poszt publikálás | "Allow user to publish AI-generated marketing content to their Instagram Business profile" |

**App Review folyamat**:

1. **App Review → Permissions and Features**
2. Mindegyik permission-nél: **Request advanced access**
3. Mindegyiknél kitölteni:
   - **How are you using this permission?**: a fenti indoklás
   - **Demo video URL**: a felvett demo-videó (Loom link)
   - **Step-by-step**: 3-5 lépésben hogyan használja a user
4. **Submit for review**
5. **Várakozási idő**: 2-4 hét. Néha első körben elutasítják → újra kell csinálni
   (általában mert a demo-videó nem mutatja meg pontosan a flow-t).

### 3.6 Test mode (review előtt)

Amíg a review folyamatban van, **csak a fejlesztő (te) és a hozzáadott
"testers"** tudnak bejelentkezni:

1. **Roles → Roles** → **Add People** → **Tester**
2. Add hozzá az ügyfeleket akiknek tesztelni kell
3. Mindenkinek el kell fogadnia a meghívót a saját FB notifications-ben

### 3.7 Railway env beállítás

Railway dashboard → Variables:

```
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
APP_URL=https://growthengine-production.up.railway.app
```

A `APP_URL` már be kell legyen állítva a LinkedIn miatt is.

---

## 4. TikTok

A TikTok külön Developer App-ot igényel. A folyamat hasonló a Meta-éhoz, de
általában gyorsabb a review.

### 4.1 TikTok Developer fiók

1. Menj a [https://developers.tiktok.com](https://developers.tiktok.com)-ra
2. **Log In** → TikTok-fiókkal vagy email-lel
3. **Manage apps** → **Connect**

### 4.2 Új App létrehozása

1. **Create app**
2. **App name**: `G2A Growth Engine`
3. **Category**: "Marketing & Advertising"
4. **Description**: rövid leírás (2-3 mondat) a SaaS-ról
5. **Platform**: **Web**
6. **Website URL**: `https://growthengine-production.up.railway.app`
7. **Privacy Policy URL**: `https://growthengine-production.up.railway.app/adatvedelem`
8. **Terms of Service URL**: `https://growthengine-production.up.railway.app/aszf`
9. **Create**

### 4.3 Login Kit beállítás

A bal oldali menüben **Login Kit**:

1. **Add scope**: `user.info.basic` (ez azonnal jóváhagyott)
2. **Redirect URI**:
   `https://growthengine-production.up.railway.app/api/oauth/tiktok/callback`
3. **Save**

### 4.4 Content Posting API (review szükséges)

A poszt-publikáláshoz külön kell kérni:

1. **Add Product** → **Content Posting API**
2. **Add scopes**: `video.publish`, `video.upload`
3. **Submit for review**
4. **Várakozási idő**: 1-3 hét

### 4.5 Test users (review előtt)

1. **Manage app** → **Add target users** (max 10 fő)
2. Mindegyik teszter saját TikTok-fiókja a fenti listára

### 4.6 Railway env beállítás

```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

---

## 5. Terms of Service oldal (új)

A Meta + TikTok **kötelezően kéri**. Készíteni kell egy egyszerű
`/aszf` oldalt. **Minta** (a `client/src/pages/Privacy.tsx` mintájára):

- Kötelező részek: szolgáltatás leírása, díjazás, felhasználói kötelezettségek,
  szolgáltató felelőssége, GDPR-utalás, vita-rendezés, hatályos jog (magyar)
- **Konzultálj jogásszal** mielőtt élesbe rakod — a sablon csak kiindulás

Jelenleg ezt **manuálisan kell létrehozni**. Ha akarod, készítek egy
sablont egy másik PR-ben.

---

## 6. Checklist

A 3 platform élesítése előtt:

- [ ] `/aszf` oldal létrehozva és live
- [ ] Meta Developer fiók létrehozva
- [ ] Meta App létrehozva + scopes kérve review-ra
- [ ] TikTok Developer fiók létrehozva
- [ ] TikTok App létrehozva + scopes kérve review-ra
- [ ] Railway env: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `APP_URL`
- [ ] Demo videó felvéve (Loom) és linkje csatolva a Meta App Review-hoz
- [ ] Tester user-ek hozzáadva mindkét platformon (review előtti tesztelésre)

A review jóváhagyása után a Beállítások → Integrációk gombok mind élesen
mennek — minden ügyfél bekötheti a saját FB Page-eit, IG Business accountját
és TikTok fiókját. A G2A Marketing super_admin tovább kezeli a saját
fiókjait és minden ügyfél clientProfile-ja külön kapja a tokeneket.

---

## 7. Költségek (2026)

- **LinkedIn Developer**: ingyenes
- **Meta Developer**: ingyenes (csak ha 1M+ post/hó-t lépsz át, akkor díjak)
- **TikTok Developer**: ingyenes
- **Demo videó**: Loom ingyenes (5 perc-ig)

Az OpenAI költségek (DALL-E képgen, GPT-4o-mini AI-prompt) változatlanok — ez a
publikálás-flow csak posztok továbbítását jelenti, AI-t nem hív.
