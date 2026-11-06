/**
 * G2A Growth Engine – Landing oldal
 * Csak létező funkciót ígér: stratégia, tartalomtervezés, SEO-audit, AI Copilot.
 * Az árazás a pilotig rejtve (SHOW_PRICING), a tartalma a LandingPricing komponensben van.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Bot, Brain, Megaphone, Search, Target, Users,
  CheckCircle2, ArrowRight, Shield, TrendingUp,
} from "lucide-react";
import { G2ALogoOnDark } from "@/components/G2ALogo";
import FadeIn from "@/components/landing/FadeIn";
import LandingPricing from "@/components/landing/LandingPricing";

// Az árazás a pilotig rejtve: true-ra állítva a szekció és a nav link is visszajön.
const SHOW_PRICING = false;

// ─── Animation helpers ────────────────────────────────────────────────────────
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
export default function Landing() {
  const bg = "#0A0A0F";
  const subtext = "text-white/50";
  const cardBg = "bg-white/[0.03] border-white/[0.06]";
  const navBg = "bg-[#0A0A0F]/90 border-white/5";

  const features = [
    { icon: Brain, title: "AI-alapú Stratégia", desc: "Az AI elemzi a vállalkozásodat és teljes marketing stratégiát generál: célközönség, tartalom pillérek, havi prioritások." },
    { icon: Megaphone, title: "Tartalom Stúdió", desc: "LinkedIn, Facebook, Instagram – tervezd, szerkeszd és hagyd jóvá a posztjaidat egy helyen." },
    { icon: Search, title: "SEO-audit", desc: "Add meg a weboldalad címét, és kapj részletes keresőoptimalizálási elemzést, konkrét javaslatokkal." },
    { icon: Target, title: "Vevői Intelligencia", desc: "Automatikus versenytárs elemzés, buyer persona generálás és márka DNA feltérképezés." },
    { icon: Bot, title: "AI Copilot", desc: "Kérdezz bátran a munka közben: az asszisztens ismeri a vállalkozásod adatait, válaszol, magyaráz és javasol." },
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
          <G2ALogoOnDark size="md" asLink className="transition-transform hover:scale-105" />

          {/* Nav links */}
          <div className={`hidden md:flex items-center gap-8 text-sm ${subtext}`}>
            <a href="#features" className="hover:text-white transition-colors">
              Funkciók
            </a>
            <a href="#how" className="hover:text-white transition-colors">
              Hogyan működik
            </a>
            {SHOW_PRICING && (
              <a href="#pricing" className="hover:text-white transition-colors">
                Árazás
              </a>
            )}
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
            A G2A Growth Engine AI-alapú marketing operációs rendszer, amely segít a vállalkozásodnak stratégiát alkotni, tartalmat tervezni és a SEO-t rendbe tenni – mindezt egyetlen platformon.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/regisztracio">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-8 h-12 text-base">
                Kezdd el ingyen! <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base bg-transparent border-white/10 text-white/70 hover:text-white hover:bg-white/5">
                Tudj meg többet!
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
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { val: "5 perc", label: "Onboarding idő" },
            { val: "3 modul", label: "Stratégia, Tartalom, SEO" },
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
              Egy platform a marketinged tervezéséhez – a stratégiától a jóváhagyott tartalomig.
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

      {/* ─── Screenshot section: Tartalom naptár ─────────────────────────────── */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <SlideIn direction="left">
              <Badge className="mb-4 bg-violet-500/10 text-violet-400 border-violet-500/20">
                Tartalom egy helyen
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Tartalom naptár
              </h2>
              <p className={`text-lg mb-8 leading-relaxed ${subtext}`}>
                Tervezd meg a havi tartalomnaptárat, és lásd egy helyen, melyik poszt hol tart.
              </p>
              <div className="space-y-3">
                {["Havi tartalom naptár LinkedIn, Facebook, Instagram platformokra", "A posztok állapota egy pillantással látszik, színkódolással"].map((item) => (
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
                  alt="Tartalom Naptár – Minta Cég Kft. Pro"
                  className="w-full object-cover"
                />
              </div>
            </SlideIn>
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

      {/* ─── Pricing (a pilotig rejtve) ──────────────────────────────────────── */}
      {SHOW_PRICING && <LandingPricing />}

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
              Regisztrálj ingyen és 5 perc alatt készen áll a marketing stratégiád.
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
          <G2ALogoOnDark size="sm" asLink />
          <div className="flex items-center gap-6 text-sm text-white/30">
            <span>© {new Date().getFullYear()} G2A Marketing</span>
            <span>·</span>
            <Link href="/adatvedelem" className="flex items-center gap-1 transition-colors hover:text-white/60">
              <Shield className="w-3 h-3" /> Adatvédelem
            </Link>
            <span>·</span>
            <Link href="/aszf" className="transition-colors hover:text-white/60">
              ÁSZF
            </Link>
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
