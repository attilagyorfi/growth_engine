/**
 * G2A Growth Engine – Adatvédelmi tájékoztató
 *
 * Magyar GDPR-szabványos alap szöveg. A részletek (cégadatok, konkrét DPO
 * kontakt, EÜ regiszter szám) később bővíthetők.
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { G2ALogoOnDark } from "@/components/G2ALogo";

export default function Privacy() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#0A0A0F", color: "white" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl bg-[#0A0A0F]/90 border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <G2ALogoOnDark size="md" asLink className="transition-transform hover:scale-105" />
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Vissza a főoldalra
            </Button>
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Adatvédelmi tájékoztató</h1>
          </div>
          <p className="text-white/50 text-sm mb-12">
            Hatályos: {new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-white/80 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-3">1. Adatkezelő</h2>
              <p>
                A G2A Growth Engine platformot a <strong>G2A Marketing</strong> üzemelteti.
                Adatkezelési kérdésekkel kapcsolatban az <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300">info@g2amarketing.hu</a> címen vehetsz fel velünk kapcsolatot.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">2. Milyen adatokat kezelünk</h2>
              <p>A platform használata során az alábbi adatkategóriák kerülhetnek kezelésre:</p>
              <ul className="list-disc list-inside space-y-2 mt-3 ml-2">
                <li><strong>Fiókadatok:</strong> név, email cím, jelszó (kriptográfiailag hash-elve)</li>
                <li><strong>Vállalkozási adatok:</strong> a profilodhoz tartozó cégadatok, weboldal, iparág, brand információk</li>
                <li><strong>Tartalmi adatok:</strong> az általad létrehozott vagy az AI által generált posztok, kampányok, stratégiák</li>
                <li><strong>Ügyfél (lead) adatok:</strong> a CRM modulba feltöltött vagy bevitt kontakt adatok</li>
                <li><strong>Használati adatok:</strong> bejelentkezési idők, AI generálások száma, funkcióhasználat</li>
                <li><strong>Számlázási adatok:</strong> Stripe előfizetés esetén a Stripe által tárolt fizetési információk</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">3. Az adatkezelés jogalapja és célja</h2>
              <p>
                Az adatkezelés jogalapja az Európai Parlament és a Tanács (EU) 2016/679 rendeletének (GDPR) 6. cikk (1) bekezdés b) pontja szerinti szerződéses jogalap (a szolgáltatás nyújtása), illetve f) pontja szerinti jogos érdek (biztonság, csalás megelőzése).
              </p>
              <p className="mt-3">
                Adataidat a következő célokra használjuk:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 ml-2">
                <li>A platform szolgáltatásainak nyújtása (auth, AI generálás, tartalomkezelés)</li>
                <li>Az ügyfélprofilod, stratégiád és tartalmaid tárolása és visszaolvasása</li>
                <li>Tranzakciós emailek küldése (jelszó visszaállítás, jóváhagyási értesítések)</li>
                <li>Számlázás és előfizetés-kezelés</li>
                <li>Biztonsági incidensek megelőzése és kivizsgálása</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">4. Adatfeldolgozók</h2>
              <p>A platform működéséhez az alábbi külső szolgáltatókat vesszük igénybe:</p>
              <ul className="list-disc list-inside space-y-2 mt-3 ml-2">
                <li><strong>TiDB Cloud (PingCAP)</strong> — adatbázis tárolás</li>
                <li><strong>Vercel</strong> — alkalmazás hosting</li>
                <li><strong>OpenAI</strong> / <strong>Anthropic</strong> — AI generálási szolgáltatások</li>
                <li><strong>Resend</strong> — tranzakciós email küldés</li>
                <li><strong>Stripe</strong> — fizetés és előfizetés-kezelés</li>
                <li><strong>HeyGen</strong> — videó generálási szolgáltatás (csak Pro és Agency csomagokban)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">5. Adattárolás időtartama</h2>
              <p>
                Adataidat addig kezeljük, amíg fiókod aktív. Fiókod törlését bármikor kérheted az
                <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300"> info@g2amarketing.hu </a>
                címen — ezt követően a kérelmedtől számított 30 napon belül töröljük adataidat,
                kivéve azokat, amelyek jogi kötelezettség (pl. számlázási rekordok) miatt tovább tárolandók.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">6. Az érintett jogai</h2>
              <p>A GDPR alapján a következő jogokkal élhetsz:</p>
              <ul className="list-disc list-inside space-y-2 mt-3 ml-2">
                <li><strong>Hozzáférési jog</strong> — a rólad tárolt adatok másolatát kikérheted</li>
                <li><strong>Helyesbítési jog</strong> — pontatlan adatok javítását kérheted</li>
                <li><strong>Törlési jog („elfeledtetéshez való jog")</strong> — fiókod és adataid törlését kérheted</li>
                <li><strong>Adathordozhatósághoz való jog</strong> — adataid strukturált formában történő átadását kérheted</li>
                <li><strong>Tiltakozási jog</strong> — bizonyos adatkezelések ellen tiltakozhatsz</li>
                <li><strong>Panasztételhez való jog</strong> — a Nemzeti Adatvédelmi és Információszabadság Hatóságnál (NAIH) panaszt tehetsz</li>
              </ul>
              <p className="mt-3">
                Bármely jog gyakorlásához írj nekünk az
                <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300"> info@g2amarketing.hu </a>
                címre.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">7. Cookie-k</h2>
              <p>
                A platform a működéséhez szükséges <strong>technikai cookie-kat</strong> használ (pl. session cookie a bejelentkezett állapot fenntartására). Ezekhez nincs szükség külön hozzájárulásra. Analitikai vagy marketing cookie-kat egyelőre nem helyezünk el.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">8. Változtatások</h2>
              <p>
                A jelen tájékoztatót időről időre frissítjük. A jelentős változásokról emailben tájékoztatunk; a kisebb módosításokat az oldal tetején lévő hatályosság dátumából követheted.
              </p>
            </section>

            <section className="border-t border-white/10 pt-8 mt-12">
              <p className="text-white/50 text-sm">
                Kérdésed van? Írj az <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300">info@g2amarketing.hu</a> címre, vagy térj vissza a <Link href="/" className="text-violet-400 hover:text-violet-300">főoldalra</Link>.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
