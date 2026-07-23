/**
 * G2A Growth Engine – Általános Szerződési Feltételek (ÁSZF)
 *
 * Magyar B2B SaaS-ra szabott alapszöveg. A Meta App Review + TikTok App
 * Review KÖTELEZŐEN kéri (Terms of Service URL). A Privacy.tsx-szel
 * párhuzamos struktúra.
 *
 * ⚠️ FIGYELEM: ez EGY KIINDULÁSI TÉRKÉP, NEM jogilag verifikált végleges
 * dokumentum. **ELőtte konzultálj jogásszal** — különösen a felelősség-
 * korlátozás, vita-rendezés és fogyasztóvédelmi részekkel kapcsolatban.
 * Cégadatok (adószám, székhely, cégjegyzékszám) manuálisan kitöltendők!
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { G2ALogoOnDark } from "@/components/G2ALogo";

export default function Aszf() {
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
              <FileText className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Általános Szerződési Feltételek</h1>
          </div>
          <p className="text-white/50 text-sm mb-8">
            Hatályos: {new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          {/* Alpha disclaimer — a mostani szoftver-állapot alatt */}
          <div className="mb-12 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-100/90 leading-relaxed">
              A G2A Growth Engine jelenleg <strong>korai fázisú (béta)</strong> szoftver. A jelen ÁSZF
              az alap szolgáltatási feltételeket tartalmazza; egyes rendelkezések a végleges
              megjelenéssel bővülhetnek. Kérdés vagy észrevétel esetén írj az{" "}
              <a href="mailto:info@g2amarketing.hu" className="underline">info@g2amarketing.hu</a> címre.
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-white/80 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-3">1. A Szolgáltató</h2>
              <p>
                A G2A Growth Engine platformot (a továbbiakban: <strong>Platform</strong> vagy <strong>Szolgáltatás</strong>) a{" "}
                <strong>G2A Marketing</strong> (a továbbiakban: <strong>Szolgáltató</strong>) üzemelteti.
                Kapcsolat: <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300">info@g2amarketing.hu</a>.
              </p>
              <p className="mt-2 text-sm text-white/50">
                <em>A cégjegyzékszám, székhely, adószám és bankszámla-adatok a végleges változatban kerülnek publikálásra.</em>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">2. A Szolgáltatás leírása</h2>
              <p>
                A Platform egy B2B AI-alapú marketing eszköztár, amely magyar kis- és középvállalkozások
                számára nyújt tartalommarketing-, stratégia-, kampány- és analitikai támogatást.
                A főbb funkciók:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3 ml-2">
                <li>AI-generált marketing stratégiák és cselekvési tervek</li>
                <li>AI-generált poszttervek és képek (LinkedIn, Facebook, Instagram, TikTok)</li>
                <li>Poszt publikáció csatlakoztatott közösségi média fiókokra</li>
                <li>SEO Audit és Core Web Vitals mérés</li>
                <li>Hírlevél kezelés (feliratkozók + kampányok)</li>
                <li>Vállalati brand-központú AI Memória</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">3. Előfizetés és díjazás</h2>
              <p>
                A Platformhoz különböző csomagok érhetők el (Ingyenes, Starter, Pro, Agency), amelyek
                havi vagy éves díjazásúak. Az aktuális árakat a főoldal Árlista szekciója tartalmazza.
              </p>
              <p className="mt-3">
                A fizetés a Stripe fizetési szolgáltatón keresztül történik (kártyaadatokat a
                Szolgáltató NEM tárol). Az előfizetés bármikor lemondható a Beállítások / Előfizetés
                menüpont alatt; a lemondás az aktuális elszámolási ciklus végén lép hatályba, azaz a
                már kifizetett időszak végéig a Szolgáltatás továbbra is elérhető marad.
              </p>
              <p className="mt-3">
                Az árváltozásokról a Szolgáltató legalább 30 nappal a hatálybalépés előtt emailben
                értesíti a felhasználókat. Az új ár csak az értesítést követő új számlázási ciklustól
                érvényes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">4. Regisztráció és felhasználói fiók</h2>
              <p>
                A Platform használatához regisztráció szükséges. A regisztráló felhasználó vállalja,
                hogy valós adatokat ad meg és fiókját harmadik személynek nem adja át. Új
                regisztrációk admin-jóváhagyás után lépnek életbe (jellemzően 1 munkanapon belül).
              </p>
              <p className="mt-3">
                A fiók törlése bármikor kérhető az{" "}
                <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300">info@g2amarketing.hu</a>{" "}
                címen. Törlés esetén az Adatvédelmi tájékoztató 5. pontja szerinti időn belül töröljük
                az adatokat.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">5. Felhasználói kötelezettségek</h2>
              <p>A felhasználó vállalja, hogy a Platform használata során:</p>
              <ul className="list-disc list-inside space-y-2 mt-3 ml-2">
                <li>Nem sért harmadik személyek jogait (szerzői jog, védjegy, személyiségi jog stb.)</li>
                <li>Nem publikál jogsértő, gyűlöletkeltő, félrevezető vagy csaló tartalmat</li>
                <li>A csatlakoztatott közösségi média fiókokon a saját (vagy megbízóként képviselt) fiókokat használja</li>
                <li>Nem próbálja meg a Platform biztonsági intézkedéseit megkerülni</li>
                <li>Nem terheli szándékosan a Platformot (pl. automatizált szkriptekkel, botnetekkel)</li>
                <li>Betartja a csatlakoztatott platformok (Meta, LinkedIn, TikTok stb.) saját feltételeit</li>
              </ul>
              <p className="mt-3">
                Súlyos vagy ismételt szabályszegés esetén a Szolgáltató a fiókot értesítés nélkül
                felfüggesztheti vagy megszüntetheti. A már kifizetett díj ilyen esetben nem kerül
                visszatérítésre.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">6. AI-generált tartalom</h2>
              <p>
                A Platform mesterséges intelligencia (OpenAI és más szolgáltatók) segítségével generál
                marketing tartalmat. Az AI kimenete <strong>ajánlás</strong>, amelynek pontosságáért,
                jogszerűségéért és üzleti alkalmasságáért a Szolgáltató nem vállal felelősséget —
                a publikálás előtt a felhasználó köteles minden generált tartalmat átnézni és
                jóváhagyni.
              </p>
              <p className="mt-3">
                A generált tartalmak szerzői joga a Platform használati feltételei szerint a
                felhasználót illetik (az OpenAI Terms of Use hatályos rendelkezésével összhangban),
                azzal a fenntartással, hogy az AI-modellek betanításához felhasznált adatokból
                következően a generált szöveg vagy kép hasonlítható más publikus műhöz — jogsértés
                esetén az egyedi felelősség a felhasználót terheli.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">7. Közösségi média integrációk</h2>
              <p>
                A Platform lehetőséget biztosít LinkedIn, Facebook (Page), Instagram (Business) és
                TikTok fiókok csatlakoztatására. A csatlakoztatáshoz a felhasználó a megfelelő
                platform OAuth flow-ját használja; a tokeneket a Szolgáltató titkosított formában
                tárolja csak addig, amíg a fiók csatlakozva van.
              </p>
              <p className="mt-3">
                A csatlakoztatott fiókokon a Platform a felhasználó nevében posztokat publikálhat.
                A publikációk tartalmáért, ütemezéséért és jogszerűségéért <strong>kizárólag a
                felhasználó felel</strong>. A Szolgáltató nem vállal felelősséget a csatlakoztatott
                platformok döntéseiért (pl. poszt eltávolítása, fiók-korlátozás, algoritmikus
                rangsorolás).
              </p>
              <p className="mt-3">
                A felhasználó bármikor lemondhatja a csatlakozást a Beállítások → Integrációk
                menüpontban. Lemondás után a tárolt token azonnal deaktiválódik.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">8. Rendelkezésre állás és korlátozások</h2>
              <p>
                A Szolgáltató célja a Platform éves szintű <strong>99%-os rendelkezésre állása</strong>,
                de kifejezetten nem garantálja a folyamatos, hibamentes vagy megszakítás nélküli
                működést. Karbantartások és váratlan leállások előfordulhatnak. Tervezett
                karbantartásról a felhasználót emailben előzetesen értesítjük.
              </p>
              <p className="mt-3">
                Az AI-generálások, közösségi média publikációk és külső API-hívások (OpenAI, Meta,
                LinkedIn, TikTok, PageSpeed Insights) a harmadik fél szolgáltatók
                rendelkezésre állásától függenek — ezek átmeneti kimaradása nem minősül szolgáltatási
                hibának.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">9. Felelősségkorlátozás</h2>
              <p>
                A Szolgáltató felelőssége a Platform használatából eredő közvetlen károkra korlátozódik,
                és — a szándékos vagy súlyos gondatlansággal okozott károk kivételével — nem haladhatja
                meg a kárt okozó eseményt megelőző 12 hónapban a felhasználó által kifizetett
                előfizetési díjak összegét.
              </p>
              <p className="mt-3">
                A Szolgáltató nem felel a Platform használatából eredő <strong>közvetett károkért,
                elmaradt haszonért, adatvesztésért</strong> vagy harmadik személyek követeléseiért,
                amennyiben ezt a hatályos jog megengedi.
              </p>
              <p className="mt-3">
                Ez a rendelkezés nem érinti a fogyasztókat megillető, kógens jogszabály által biztosított
                jogokat.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">10. Adatvédelem</h2>
              <p>
                A személyes adatok kezelését az{" "}
                <Link href="/adatvedelem" className="text-violet-400 hover:text-violet-300">
                  Adatvédelmi tájékoztató
                </Link>{" "}
                részletezi, amely a jelen ÁSZF elválaszthatatlan része. A regisztrációval a
                felhasználó kifejezetten elismeri, hogy az Adatvédelmi tájékoztatót megismerte.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">11. Szellemi tulajdon</h2>
              <p>
                A Platform (forráskód, dizájn, védjegy, dokumentáció) a Szolgáltató kizárólagos
                szellemi tulajdona. A felhasználó a szolgáltatás igénybevételéhez szükséges,
                nem kizárólagos, nem átruházható, visszavonható használati jogot kap; ezen felül
                a Platformot vagy annak részeit tilos másolni, viszonteladni, visszafejteni vagy
                származékos műveket készíteni belőle.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">12. Az ÁSZF módosítása</h2>
              <p>
                A Szolgáltató fenntartja a jogot a jelen ÁSZF egyoldalú módosítására. Lényeges
                módosításról a felhasználót emailben, illetve a Platformon belüli értesítés útján
                legalább <strong>15 nappal előre</strong> tájékoztatjuk. A módosítás hatályba lépése
                előtt a felhasználó jogosult az előfizetést azonnali hatállyal felmondani.
              </p>
              <p className="mt-3">
                Ha a felhasználó a módosítás hatályba lépése után is használja a Platformot, ez a
                módosított feltételek elfogadásának minősül.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">13. Vita rendezése</h2>
              <p>
                A jelen ÁSZF-re és a Platform használatára a <strong>magyar jog</strong> az
                irányadó. A felek a jogvitákat elsősorban egyeztetéssel próbálják rendezni; ennek
                sikertelensége esetén — a fogyasztóvédelmi jogszabályokban foglalt kivételekkel —
                a Szolgáltató székhelye szerinti bíróság illetékes.
              </p>
              <p className="mt-3">
                Fogyasztónak minősülő felhasználó panasza esetén a Budapesti Békéltető Testülethez
                (
                <a href="https://bekeltet.bkik.hu/" target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">
                  bekeltet.bkik.hu
                </a>
                ) fordulhat.
              </p>
            </section>

            <section className="border-t border-white/10 pt-8 mt-12">
              <p className="text-white/50 text-sm">
                Kérdésed van? Írj az{" "}
                <a href="mailto:info@g2amarketing.hu" className="text-violet-400 hover:text-violet-300">
                  info@g2amarketing.hu
                </a>{" "}
                címre, olvasd el az{" "}
                <Link href="/adatvedelem" className="text-violet-400 hover:text-violet-300">
                  Adatvédelmi tájékoztatót
                </Link>
                , vagy térj vissza a{" "}
                <Link href="/" className="text-violet-400 hover:text-violet-300">
                  főoldalra
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
