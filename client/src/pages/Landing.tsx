/**
 * G2A Growth Engine – Landing Page v4.0
 * Animated, bilingual, with synced pricing and real content
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import {
  BarChart3, Brain, Mail, Megaphone, Target, Users,
  CheckCircle2, ArrowRight, Zap, Shield, TrendingUp,
  Sparkles, Rocket, Building2, Crown,
} from "lucide-react";

// ─── Shared Plans (synced with Register.tsx) ──────────────────────────────────
const PLANS = [
  { id: "free", name: "Ingyenes", price: "0 Ft", period: "/hó", icon: Sparkles, description: "Ismerkedj meg a platformmal", features: ["1 vállalkozás profil", "1 AI stratégia/hó", "5 AI poszt/hó", "1 SEO audit/hó", "Alapanalitika (export nélkül)"], cta: "Kezdd el ingyen", popular: false, highlight: false },
  { id: "starter", name: "Starter", price: "9 900 Ft", period: "/hó", icon: Rocket, description: "Kis vállalkozásoknak", features: ["1 vállalkozás profil", "5 AI stratégia/hó", "50 AI poszt/hó", "3 SEO audit/hó", "Lead & kampány kezelés", "Analitika export"], cta: "Starter indítása", popular: true, highlight: true },
  { id: "pro", name: "Pro", price: "24 900 Ft", period: "/hó", icon: Building2, description: "Növekvő vállalkozásoknak", features: ["3 vállalkozás profil", "300 AI szöveges/hó", "30 AI kép/hó", "5 HeyGen AI videó/hó", "10 SEO audit/hó", "Prioritásos támogatás"], cta: "Pro indítása", popular: false, highlight: false },
  { id: "agency", name: "Agency", price: "49 900 Ft", period: "/hó", icon: Crown, description: "Marketing ügynökségeknek", features: ["Korlátlan projekt", "1 000 AI szöveges/hó", "100 AI kép/hó", "15 HeyGen AI videó/hó", "30 SEO audit/hó", "White-label lehetőség", "Dedikált támogatás"], cta: "Agency indítása", popular: false, highlight: false },
] as const;

// ─── Animation helpers ────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SlideIn({ children, delay = 0, direction = "left", className = "" }: { children: React.ReactNode; delay?: number; direction?: "left" | "right"; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: direction === "left" ? -32 : 32 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// ─── Annual prices (10 months = 2 months free) ───────────────────────────────
const ANNUAL_PRICES: Record<string, string> = {
  free: "0 Ft", starter: "99 000 Ft", pro: "249 000 Ft", agency: "499 000 Ft",
};
const ANNUAL_MONTHLY_EQUIV: Record<string, string> = {
  free: "0 Ft/hó", starter: "8 250 Ft/hó", pro: "20 750 Ft/hó", agency: "41 583 Ft/hó",
};

export default function Landing() {
  const [isYearly, setIsYearly] = useState(false);

  const bg = "#0A0A0F";
  const subtext = "text-white/50";
  const cardBg = "bg-white/[0.03] border-white/[0.06]";
  const navBg = "bg-[#0A0A0F]/90 border-white/5";

  const features = [
    { icon: Brain, title: "AI-alapú Stratégia", desc: "Az AI elemzi a vállalkozásodat és teljes marketing stratégiát generál: célközönség, tartalom pillérek, havi prioritások." },
    { icon: Megaphone, title: "Tartalom Stúdió", desc: "LinkedIn, Facebook, Instagram, TikTok – ütemezd, szerkeszd és hagyd jóvá a posztjaidat egy helyen." },
    { icon: Mail, title: "Értékesítési Ops", desc: "Lead kezelés, kimenő email kampányok és beérkező válaszok nyomon követése egyetlen felületen." },
    { icon: Target, title: "Vevői Intelligencia", desc: "Automatikus versenytárs elemzés, buyer persona generálás és márka DNA feltérképezés." },
    { icon: BarChart3, title: "Analitika & KPI", desc: "Valós idejű teljesítmény mutatók, tartalom hatékonyság és lead konverzió nyomon követése." },
    { icon: Users, title: "Ügyfél Workspace", desc: "Minden ügyfélnek saját, izolált munkaterülete van – az adataik biztonságban maradnak." },
  ];

  const steps = [
    { num: "01", title: "Regisztrálj", desc: "Hozz létre ingyenes fiókot 30 másodperc alatt." },
    { num: "02", title: "Onboarding", desc: "Az AI feltérképezi a vállalkozásodat és elkészíti a profilt." },
    { num: "03", title: "Stratégia", desc: "Kapj személyre szabott marketing stratégiát azonnal." },
    { num: "04", title: "Növekedj", desc: "Hajtsd végre a terveket és kövesd az eredményeket." },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: bg, color: "white" }}>

      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl ${navBg}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo – clickable, goes to home */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">G2A Growth Engine</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className={`hidden md:flex items-center gap-8 text-sm ${subtext}`}>
            <a href="#features" className="hover:text-white transition-colors">
              Funkciók
            </a>
            <a href="#how" className="hover:text-white transition-colors">
              Hogyan működik
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Árazás
            </a>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link href="/bejelentkezes">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                Bejelentkezés
              </Button>
            </Link>
            <Link href="/regisztracio">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                Kezdd el ingyen
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Badge className="mb-6 bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/10">
              🚀 AI-alapú marketing platform
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight"
          >
            <>Marketing stratégia,{" "}<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">AI sebességgel</span></>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`text-xl mb-10 max-w-2xl mx-auto leading-relaxed ${subtext}`}
          >
            A G2A Growth Engine AI-alapú marketing operációs rendszer, amely segít a vállalkozásodnak stratégiát alkotni, tartalmat gyártani és leadeket generálni – mindezt egyetlen platformon."
             
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/regisztracio">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-8 h-12 text-base">
                Kezdj el ingyen <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/5">
                Tudj meg többet
              </Button>
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-sm text-white/30"
          >
            Nincs szükség bankkártya adatok megadására · Ingyenes csomag elérhető
          </motion.p>
        </div>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 max-w-5xl mx-auto relative"
        >
          <div className="rounded-2xl overflow-hidden border shadow-2xl border-white/10 shadow-violet-900/20">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/109169450/WzYbMH2rdiW2pftdUmZaz8/screenshot-dashboard-minta-Hy6fyXi499rgi2TiWUxnqb.webp"
              alt="G2A Growth Engine Dashboard – Minta Cég Kft. Pro"
              className="w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-transparent to-transparent pointer-events-none rounded-2xl" />
        </motion.div>
      </section>

      {/* ─── Stats ───────────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: "10x", label: "Gyorsabb stratégia alkotás" },
            { val: "5 perc", label: "Onboarding idő" },
            { val: "3 modul", label: "Stratégia, Tartalom, Sales" },
            { val: "100%", label: "Magyar nyelvű" },
          ].map((stat, i) => (
            <FadeIn key={stat.val} delay={i * 0.08}>
              <div className="text-3xl font-bold text-violet-400 mb-1">{stat.val}</div>
              <div className={`text-sm ${subtext}`}>{stat.label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Minden, amire szükséged van
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${subtext}`}>
              Egy platform, amely lefedi a teljes marketing és értékesítési folyamatot – az ötlettől az eredményig."
               
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.07}>
                <Card className={`h-full hover:scale-[1.02] transition-transform duration-300 ${cardBg}`}>
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className={`text-sm leading-relaxed ${subtext}`}>{f.desc}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Screenshot section: Tartalom naptár + Videókészítő ──────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <SlideIn direction="left">
              <Badge className="mb-4 bg-violet-500/10 text-violet-400 border-violet-500/20">
                Tartalom + Videó egy helyen
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Tartalom naptár és AI videókészítő
              </h2>
              <p className={`text-lg mb-8 leading-relaxed ${subtext}`}>
                Tervezd meg a hónapos tartalomnaptárat, majd Pro csomaggal alakítsd át a legjobb posztjaidat HeyGen AI avatár videókká – kamera és stúdió nélkül."
                 
              </p>
              <div className="space-y-3">
                {["Havi tartalom naptár LinkedIn, Facebook, Instagram platformokra", "Vázlat, ütemezett és közzétett posztok színkódolással", "AI avatár videók szkriptből – 2-5 perc alatt (Pro)", "5 videó per hónap a Pro csomagban"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" />
                    <span className={`text-sm ${subtext}`}>{item}</span>
                  </div>
                ))}
              </div>
            </SlideIn>
            <SlideIn direction="right" delay={0.15}>
              <div className="rounded-2xl overflow-hidden border shadow-xl border-white/10">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/109169450/WzYbMH2rdiW2pftdUmZaz8/screenshot-content-minta-QFnVmj9cHdhsCZ6tLWtfDx.webp"
                  alt="Tartalom Naptár és Videókészítő – Minta Cég Kft. Pro"
                  className="w-full object-cover"
                />
              </div>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* ─── Jövőbeli funkciók (Roadmap) ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              🚧 Hamarosan
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              A platform folyamatosan bővül
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${subtext}`}>
              A G2A Growth Engine egy élő termék – folyamatosan új funkciókkal bővítjük az ügyfelek visszajelzései alapján."
               
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "🎙️", phase: "Q3 2026", title: "Podcast & Hang Stúdió", desc: "AI-alapú podcast szkript generálás, hangfelvétel és automatikus átirat egy helyen." },
              { icon: "📊", phase: "Q3 2026", title: "Fejlett Riportálás", desc: "Automatikus heti és havi marketing riportok PDF-ben – küldhető az ügyfeleknek." },
              { icon: "🤝", phase: "Q4 2026", title: "Csapat Együttműködés", desc: "Több felhasználó egy munkaterületen, szerepkörökkel és jóváhagyási folyamatokkal." },
              { icon: "🔗", phase: "Q4 2026", title: "Direkt Social Közzététel", desc: "Valódi OAuth integráció LinkedIn, Facebook és Instagram API-val – automatikus közzététel az ütemezés alapján." },
              { icon: "🌐", phase: "2027 Q1", title: "Többnyelvű Tartalom", desc: "Tartalmak automatikus fordítása és lokalizációja 10+ nyelvre AI segítségével." },
              { icon: "🛒", phase: "2027 Q1", title: "E-commerce Integráció", desc: "Shopify, WooCommerce és Unas összekötés – termék adatok automatikus betöltése a tartalom generáláshoz." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.07}>
                <Card className={`h-full relative overflow-hidden ${cardBg} hover:scale-[1.02] transition-transform duration-300`}>
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/40 via-violet-500/40 to-transparent" />
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl">{item.icon}</span>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                        {item.phase}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className={`text-sm leading-relaxed ${subtext}`}>{item.desc}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Hogyan működik?
            </h2>
            <p className={`text-lg ${subtext}`}>
              Négy egyszerű lépés a marketing sikerhez
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <FadeIn key={step.num} delay={i * 0.1}>
                <div className="relative text-center">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-6 left-[60%] right-0 h-px bg-gradient-to-r from-violet-500/40 to-transparent" />
                  )}
                  <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 text-violet-400 font-bold text-sm">
                    {step.num}
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className={`text-sm ${subtext}`}>{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Egyszerű árazás
            </h2>
            <p className={`text-lg mb-8 ${subtext}`}>
              Kezdj el ingyen, fejlődj velünk
            </p>
            {/* Éves/havi kapcsoló */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setIsYearly(false)}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={!isYearly ? { background: "oklch(0.6 0.2 255)", color: "white" } : { color: "rgba(255,255,255,0.45)" }}
              >
                Havi
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                style={isYearly ? { background: "oklch(0.6 0.2 255)", color: "white" } : { color: "rgba(255,255,255,0.45)" }}
              >
                Éves
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "oklch(0.65 0.18 165 / 30%)", color: "oklch(0.65 0.18 165)" }}>
                  -17%
                </span>
              </button>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <FadeIn key={plan.id} delay={i * 0.1}>
                <Card className={`h-full relative overflow-hidden transition-transform duration-300 hover:scale-[1.03] ${
                  plan.highlight
                    ? "bg-violet-600/10 border-violet-500/40"
                    : cardBg
                }`}>
                  {plan.popular && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-violet-500 text-white border-0 text-xs">
                        Legnépszerűbb
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-8">
                    <div className="mb-6">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3">
                        <plan.icon className="w-5 h-5 text-violet-400" />
                      </div>
                      <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                      <motion.div
                        key={isYearly ? "yearly" : "monthly"}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mb-1"
                      >
                        <div className="text-3xl font-bold">
                          {isYearly && plan.id !== "free" ? ANNUAL_PRICES[plan.id] ?? plan.price : plan.price}
                          {isYearly && plan.id !== "free" ? (
                            <span className={`text-base font-normal ml-1 ${subtext}`}>/év</span>
                          ) : (
                            <span className={`text-base font-normal ml-1 ${subtext}`}>{plan.period}</span>
                          )}
                        </div>
                        {isYearly && plan.id !== "free" && (
                          <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.18 165)" }}>
                            {ANNUAL_MONTHLY_EQUIV[plan.id]} – 2 hónap ingyen
                          </p>
                        )}
                      </motion.div>
                      <p className={`text-sm ${subtext}`}>{plan.description}</p>
                    </div>
                    <ul className="space-y-2.5 mb-8">
                      {plan.features.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                          <span className={subtext}>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/regisztracio">
                      <Button className={`w-full ${plan.highlight ? "bg-violet-600 hover:bg-violet-500 text-white border-0" : "bg-white/10 hover:bg-white/15 text-white border-0"}`}>
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>


            {/* ─── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-violet-400 mb-4">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">
                Csatlakozz a növekvő vállalkozásokhoz
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Készen állsz a növekedésre?
            </h2>
            <p className={`text-lg mb-10 ${subtext}`}>
              Regisztrálj ingyen és 5 perc alatt készen áll a marketing stratégiád."
               
            </p>
            <Link href="/regisztracio">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-10 h-14 text-lg">
                Kezdj el most – ingyen <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="font-semibold text-sm">G2A Growth Engine</span>
            </div>
          </Link>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <span>© 2026 G2A Marketing</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Adatvédelem</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/30">
            <Link href="/bejelentkezes" className="transition-colors hover:text-white/60">
              Bejelentkezés
            </Link>
            <Link href="/regisztracio" className="transition-colors hover:text-white/60">
              Regisztráció
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
