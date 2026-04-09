/**
 * G2A Growth Engine – Landing Page v4.0
 * Animated, bilingual, with synced pricing and real content
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  BarChart3, Brain, Mail, Megaphone, Target, Users,
  CheckCircle2, ArrowRight, Zap, Shield, TrendingUp,
  Sun, Moon, Sparkles, Rocket, Building2,
} from "lucide-react";

// ─── Shared Plans (synced with Register.tsx) ──────────────────────────────────
const PLANS = [
  {
    id: "free",
    name: { hu: "Ingyenes", en: "Free" },
    price: "0 Ft",
    period: { hu: "/hó", en: "/mo" },
    icon: Sparkles,
    description: { hu: "Ismerkedj meg a platformmal", en: "Get to know the platform" },
    features: {
      hu: ["1 vállalkozás profil", "AI stratégia (1x/hó)", "5 tartalom/hó", "Alapanalitika"],
      en: ["1 business profile", "AI strategy (1x/mo)", "5 content/mo", "Basic analytics"],
    },
    cta: { hu: "Ingyenes regisztráció", en: "Start for free" },
    popular: false,
    highlight: false,
  },
  {
    id: "starter",
    name: { hu: "Starter", en: "Starter" },
    price: "29 900 Ft",
    period: { hu: "/hó", en: "/mo" },
    icon: Rocket,
    description: { hu: "Kis vállalkozásoknak", en: "For small businesses" },
    features: {
      hu: ["1 vállalkozás profil", "Korlátlan AI stratégia", "50 tartalom/hó", "Email kampányok", "Lead kezelés"],
      en: ["1 business profile", "Unlimited AI strategy", "50 content/mo", "Email campaigns", "Lead management"],
    },
    cta: { hu: "Starter indítása", en: "Start Starter" },
    popular: true,
    highlight: true,
  },
  {
    id: "pro",
    name: { hu: "Pro", en: "Pro" },
    price: "59 900 Ft",
    period: { hu: "/hó", en: "/mo" },
    icon: Building2,
    description: { hu: "Növekvő vállalkozásoknak", en: "For growing businesses" },
    features: {
      hu: ["3 vállalkozás profil", "Korlátlan minden", "AI képgenerálás", "Prioritásos támogatás", "White-label lehetőség"],
      en: ["3 business profiles", "Unlimited everything", "AI image generation", "Priority support", "White-label option"],
    },
    cta: { hu: "Pro indítása", en: "Start Pro" },
    popular: false,
    highlight: false,
  },
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
export default function Landing() {
  const { lang, t } = useLanguage();
  const { theme, toggleTheme, switchable } = useTheme();
  const handleToggleTheme = () => toggleTheme?.();

  const isDark = theme === "dark";
  const bg = isDark ? "#0A0A0F" : "#F8F8FC";
  const text = isDark ? "text-white" : "text-gray-900";
  const subtext = isDark ? "text-white/50" : "text-gray-500";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-200";
  const navBg = isDark ? "bg-[#0A0A0F]/90 border-white/5" : "bg-white/90 border-gray-200";

  const features = [
    {
      icon: Brain,
      title: { hu: "AI-alapú Stratégia", en: "AI-Powered Strategy" },
      desc: {
        hu: "Az AI elemzi a vállalkozásodat és teljes marketing stratégiát generál: célközönség, tartalom pillérek, havi prioritások.",
        en: "AI analyzes your business and generates a complete marketing strategy: audience, content pillars, monthly priorities.",
      },
    },
    {
      icon: Megaphone,
      title: { hu: "Tartalom Stúdió", en: "Content Studio" },
      desc: {
        hu: "LinkedIn, Facebook, Instagram, TikTok – ütemezd, szerkeszd és hagyd jóvá a posztjaidat egy helyen.",
        en: "LinkedIn, Facebook, Instagram, TikTok – schedule, edit and approve your posts in one place.",
      },
    },
    {
      icon: Mail,
      title: { hu: "Értékesítési Ops", en: "Sales Ops" },
      desc: {
        hu: "Lead kezelés, kimenő email kampányok és beérkező válaszok nyomon követése egyetlen felületen.",
        en: "Lead management, outbound email campaigns and inbound reply tracking in one interface.",
      },
    },
    {
      icon: Target,
      title: { hu: "Vevői Intelligencia", en: "Customer Intelligence" },
      desc: {
        hu: "Automatikus versenytárs elemzés, buyer persona generálás és márka DNA feltérképezés.",
        en: "Automatic competitor analysis, buyer persona generation and brand DNA mapping.",
      },
    },
    {
      icon: BarChart3,
      title: { hu: "Analitika & KPI", en: "Analytics & KPIs" },
      desc: {
        hu: "Valós idejű teljesítmény mutatók, tartalom hatékonyság és lead konverzió nyomon követése.",
        en: "Real-time performance metrics, content effectiveness and lead conversion tracking.",
      },
    },
    {
      icon: Users,
      title: { hu: "Ügyfél Workspace", en: "Client Workspace" },
      desc: {
        hu: "Minden ügyfélnek saját, izolált munkaterülete van – az adataik biztonságban maradnak.",
        en: "Every client has their own isolated workspace – their data stays secure.",
      },
    },
  ];

  const steps = [
    { num: "01", title: { hu: "Regisztrálj", en: "Register" }, desc: { hu: "Hozz létre ingyenes fiókot 30 másodperc alatt.", en: "Create a free account in 30 seconds." } },
    { num: "02", title: { hu: "Onboarding", en: "Onboarding" }, desc: { hu: "Az AI feltérképezi a vállalkozásodat és elkészíti a profilt.", en: "AI maps your business and creates your profile." } },
    { num: "03", title: { hu: "Stratégia", en: "Strategy" }, desc: { hu: "Kapj személyre szabott marketing stratégiát azonnal.", en: "Get a personalized marketing strategy instantly." } },
    { num: "04", title: { hu: "Növekedj", en: "Grow" }, desc: { hu: "Hajtsd végre a terveket és kövesd az eredményeket.", en: "Execute the plans and track the results." } },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: bg, color: isDark ? "white" : "#111" }}>

      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl ${navBg}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo – clickable, goes to home */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className={`font-bold text-lg tracking-tight ${text}`}>G2A Growth Engine</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className={`hidden md:flex items-center gap-8 text-sm ${subtext}`}>
            <a href="#features" className={`hover:${isDark ? "text-white" : "text-gray-900"} transition-colors`}>
              {lang === "hu" ? "Funkciók" : "Features"}
            </a>
            <a href="#how" className={`hover:${isDark ? "text-white" : "text-gray-900"} transition-colors`}>
              {lang === "hu" ? "Hogyan működik" : "How it works"}
            </a>
            <a href="#pricing" className={`hover:${isDark ? "text-white" : "text-gray-900"} transition-colors`}>
              {lang === "hu" ? "Árazás" : "Pricing"}
            </a>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Language switcher – only on public pages */}
            <LanguageSwitcher variant="compact" />

            {/* Dark/light toggle */}
            {switchable && (
              <button
                onClick={handleToggleTheme}
                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"}`}
                title={isDark ? "Világos mód" : "Sötét mód"}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            <Link href="/bejelentkezes">
              <Button variant="ghost" size="sm" className={isDark ? "text-white/70 hover:text-white" : "text-gray-600 hover:text-gray-900"}>
                {lang === "hu" ? "Bejelentkezés" : "Login"}
              </Button>
            </Link>
            <Link href="/regisztracio">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                {lang === "hu" ? "Ingyenes próba" : "Free trial"}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        {isDark && (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}
        <div className="max-w-4xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Badge className="mb-6 bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/10">
              🚀 {lang === "hu" ? "AI-alapú marketing platform" : "AI-powered marketing platform"}
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight"
          >
            {lang === "hu" ? (
              <>Marketing stratégia,{" "}<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">AI sebességgel</span></>
            ) : (
              <>Marketing strategy,{" "}<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">at AI speed</span></>
            )}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`text-xl mb-10 max-w-2xl mx-auto leading-relaxed ${subtext}`}
          >
            {lang === "hu"
              ? "A G2A Growth Engine AI-alapú marketing operációs rendszer, amely segít a vállalkozásodnak stratégiát alkotni, tartalmat gyártani és leadeket generálni – mindezt egyetlen platformon."
              : "G2A Growth Engine is an AI-powered marketing operating system that helps your business create strategy, produce content and generate leads – all on one platform."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/regisztracio">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-8 h-12 text-base">
                {lang === "hu" ? "Kezdj el ingyen" : "Start for free"} <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className={`px-8 h-12 text-base bg-transparent ${isDark ? "border-white/10 text-white/70 hover:text-white hover:bg-white/5" : "border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}>
                {lang === "hu" ? "Tudj meg többet" : "Learn more"}
              </Button>
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`mt-4 text-sm ${isDark ? "text-white/30" : "text-gray-400"}`}
          >
            {lang === "hu" ? "Nincs szükség bankkártyára · Ingyenes csomag elérhető" : "No credit card required · Free plan available"}
          </motion.p>
        </div>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 max-w-5xl mx-auto relative"
        >
          <div className={`rounded-2xl overflow-hidden border shadow-2xl ${isDark ? "border-white/10 shadow-violet-900/20" : "border-gray-200 shadow-gray-200"}`}>
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/109169450/WzYbMH2rdiW2pftdUmZaz8/dashboard-hero_e45d4804.jpg"
              alt="G2A Growth Engine Dashboard"
              className="w-full object-cover"
            />
          </div>
          {isDark && <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-transparent to-transparent pointer-events-none rounded-2xl" />}
        </motion.div>
      </section>

      {/* ─── Stats ───────────────────────────────────────────────────────────── */}
      <section className={`py-12 px-6 border-y ${isDark ? "border-white/5" : "border-gray-100"}`}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: "10x", label: { hu: "Gyorsabb stratégia alkotás", en: "Faster strategy creation" } },
            { val: "5 perc", label: { hu: "Onboarding idő", en: "Onboarding time" } },
            { val: "3 modul", label: { hu: "Stratégia, Tartalom, Sales", en: "Strategy, Content, Sales" } },
            { val: "100%", label: { hu: "Magyar nyelvű", en: "Hungarian-first" } },
          ].map((stat, i) => (
            <FadeIn key={stat.val} delay={i * 0.08}>
              <div className="text-3xl font-bold text-violet-400 mb-1">{stat.val}</div>
              <div className={`text-sm ${subtext}`}>{stat.label[lang]}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              {lang === "hu" ? "Minden, amire szükséged van" : "Everything you need"}
            </h2>
            <p className={`text-lg max-w-2xl mx-auto ${subtext}`}>
              {lang === "hu"
                ? "Egy platform, amely lefedi a teljes marketing és értékesítési folyamatot – az ötlettől az eredményig."
                : "One platform covering the entire marketing and sales process – from idea to results."}
            </p>
          </FadeIn>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title.hu} delay={i * 0.07}>
                <Card className={`h-full hover:scale-[1.02] transition-transform duration-300 ${cardBg}`}>
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                      <f.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{f.title[lang]}</h3>
                    <p className={`text-sm leading-relaxed ${subtext}`}>{f.desc[lang]}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Screenshot section ──────────────────────────────────────────────── */}
      <section className={`py-24 px-6 ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <SlideIn direction="left">
              <Badge className="mb-4 bg-violet-500/10 text-violet-400 border-violet-500/20">
                {lang === "hu" ? "Valódi adatok, valódi eredmények" : "Real data, real results"}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                {lang === "hu" ? "Minden adat egy helyen, átláthatóan" : "All data in one place, clearly"}
              </h2>
              <p className={`text-lg mb-8 leading-relaxed ${subtext}`}>
                {lang === "hu"
                  ? "Az analitika modul valós idejű adatokat mutat a tartalmaid teljesítményéről, a lead konverzióról és az email kampányok hatékonyságáról."
                  : "The analytics module shows real-time data on your content performance, lead conversion and email campaign effectiveness."}
              </p>
              <div className="space-y-3">
                {(lang === "hu"
                  ? ["Valós idejű lead konverzió nyomon követés", "Email megnyitási és kattintási arányok", "Tartalom teljesítmény platformonként", "AI-alapú ajánlások az adatok alapján"]
                  : ["Real-time lead conversion tracking", "Email open and click rates", "Content performance by platform", "AI-based recommendations from data"]
                ).map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" />
                    <span className={`text-sm ${subtext}`}>{item}</span>
                  </div>
                ))}
              </div>
            </SlideIn>
            <SlideIn direction="right" delay={0.15}>
              <div className={`rounded-2xl overflow-hidden border shadow-xl ${isDark ? "border-white/10" : "border-gray-200"}`}>
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/109169450/WzYbMH2rdiW2pftdUmZaz8/dashboard-analytics_8cbb760e.png"
                  alt="Analytics Dashboard"
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
              {lang === "hu" ? "Hogyan működik?" : "How does it work?"}
            </h2>
            <p className={`text-lg ${subtext}`}>
              {lang === "hu" ? "Négy egyszerű lépés a marketing sikerhez" : "Four simple steps to marketing success"}
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
                  <h3 className="font-semibold mb-2">{step.title[lang]}</h3>
                  <p className={`text-sm ${subtext}`}>{step.desc[lang]}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className={`py-24 px-6 ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              {lang === "hu" ? "Egyszerű árazás" : "Simple pricing"}
            </h2>
            <p className={`text-lg ${subtext}`}>
              {lang === "hu" ? "Kezdj el ingyen, fejlődj velünk" : "Start free, grow with us"}
            </p>
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
                        {lang === "hu" ? "Legnépszerűbb" : "Most popular"}
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-8">
                    <div className="mb-6">
                      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3">
                        <plan.icon className="w-5 h-5 text-violet-400" />
                      </div>
                      <h3 className="text-xl font-bold mb-1">{plan.name[lang]}</h3>
                      <div className="text-3xl font-bold mb-1">
                        {plan.price}
                        <span className={`text-base font-normal ml-1 ${subtext}`}>{plan.period[lang]}</span>
                      </div>
                      <p className={`text-sm ${subtext}`}>{plan.description[lang]}</p>
                    </div>
                    <ul className="space-y-2.5 mb-8">
                      {plan.features[lang].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                          <span className={subtext}>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/regisztracio">
                      <Button className={`w-full ${plan.highlight ? "bg-violet-600 hover:bg-violet-500 text-white border-0" : isDark ? "bg-white/10 hover:bg-white/15 text-white border-0" : "bg-gray-100 hover:bg-gray-200 text-gray-900 border-0"}`}>
                        {plan.cta[lang]}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ──────────────────────────────────────────────────── */}
      <section className={`py-24 px-6 ${isDark ? "" : "bg-gray-50"}`}>
        <FadeIn>
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <Badge variant="outline" className="mb-4 text-violet-400 border-violet-400/30">
                {lang === "hu" ? "Ügyfélvélemények" : "Testimonials"}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {lang === "hu" ? "Amit ügyfeleink mondanak" : "What our clients say"}
              </h2>
              <p className={`text-lg max-w-2xl mx-auto ${subtext}`}>
                {lang === "hu"
                  ? "Valódi vállalkozók, valódi eredmények – lássuk, hogyan segített a G2A Growth Engine."
                  : "Real businesses, real results – see how G2A Growth Engine made a difference."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  name: "Kovács Péter",
                  company: "TechStart Kft.",
                  role: { hu: "Ügyvezető igazgató", en: "Managing Director" },
                  avatar: "K",
                  color: "oklch(0.6 0.2 255)",
                  plan: "Pro",
                  stars: 5,
                  quote: {
                    hu: "A G2A Growth Engine teljesen átalakította a marketing folyamatainkat. 3 hónap alatt 40%-kal nőtt az organikus forgalmunk, és az AI-generált stratégiák pontosan azt adták, amire szükségünk volt.",
                    en: "G2A Growth Engine completely transformed our marketing processes. Our organic traffic grew by 40% in 3 months, and the AI-generated strategies gave us exactly what we needed."
                  }
                },
                {
                  name: "Nagy Eszter",
                  company: "Bloom Design Studio",
                  role: { hu: "Alapító & Kreatív vezető", en: "Founder & Creative Director" },
                  avatar: "N",
                  color: "oklch(0.65 0.18 165)",
                  plan: "Starter",
                  stars: 5,
                  quote: {
                    hu: "Egyedüli vállalkozóként nem volt időm és erőforrásaim profi marketing stratégiára. A G2A 5 perc alatt elkészítette a teljes brand stratégiámat – mintha egy egész marketing csapatom lenne.",
                    en: "As a solo entrepreneur, I didn't have time or resources for professional marketing strategy. G2A created my entire brand strategy in 5 minutes – it's like having a whole marketing team."
                  }
                },
                {
                  name: "Horváth Gábor",
                  company: "Meridian Solutions",
                  role: { hu: "Marketing igazgató", en: "Marketing Director" },
                  avatar: "H",
                  color: "oklch(0.75 0.18 75)",
                  plan: "Agency",
                  stars: 5,
                  quote: {
                    hu: "Az ügyfélkezelés és a kampánytervezés soha nem volt ilyen hatékony. Az AI-alapú tartalom generálás hetente órákat spórol meg a csapatomnak, és az eredmények magukért beszélnek.",
                    en: "Client management and campaign planning have never been this efficient. AI-based content generation saves my team hours every week, and the results speak for themselves."
                  }
                },
              ].map((t, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div
                    className={`rounded-2xl p-6 h-full flex flex-col ${
                      isDark ? "bg-white/[0.04] border border-white/[0.08]" : "bg-white border border-gray-200 shadow-sm"
                    }`}
                  >
                    {/* Stars */}
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: t.stars }).map((_, si) => (
                        <svg key={si} className="w-4 h-4" fill="oklch(0.75 0.18 75)" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>

                    {/* Quote */}
                    <blockquote className={`text-sm leading-relaxed flex-1 mb-5 ${isDark ? "text-white/70" : "text-gray-600"}`}>
                      &ldquo;{t.quote[lang]}&rdquo;
                    </blockquote>

                    {/* Author */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}bb)` }}
                      >
                        {t.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t.name}</p>
                        <p className={`text-xs truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>{t.company} &middot; {t.role[lang]}</p>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${t.color}20`, color: t.color }}
                      >
                        {t.plan}
                      </span>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap justify-center gap-8">
              {[
                { value: "200+", label: { hu: "aktív vállalkozás", en: "active businesses" } },
                { value: "4.9/5", label: { hu: "átlagos értékelés", en: "average rating" } },
                { value: "98%", label: { hu: "elégedettségi arány", en: "satisfaction rate" } },
                { value: "5 perc", label: { hu: "átlagos beállítási idő", en: "avg. setup time" } },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-2xl font-bold text-violet-400">{stat.value}</p>
                  <p className={`text-sm ${subtext}`}>{stat.label[lang]}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-violet-400 mb-4">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">
                {lang === "hu" ? "Csatlakozz a növekvő vállalkozásokhoz" : "Join growing businesses"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              {lang === "hu" ? "Készen állsz a növekedésre?" : "Ready to grow?"}
            </h2>
            <p className={`text-lg mb-10 ${subtext}`}>
              {lang === "hu"
                ? "Regisztrálj ingyen és 5 perc alatt készen áll a marketing stratégiád."
                : "Register for free and your marketing strategy will be ready in 5 minutes."}
            </p>
            <Link href="/regisztracio">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-10 h-14 text-lg">
                {lang === "hu" ? "Kezdj el most – ingyen" : "Start now – for free"} <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className={`py-12 px-6 border-t ${isDark ? "border-white/5" : "border-gray-100"}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="font-semibold text-sm">G2A Growth Engine</span>
            </div>
          </Link>
          <div className={`flex items-center gap-6 text-sm ${isDark ? "text-white/30" : "text-gray-400"}`}>
            <span>© 2025 G2A Marketing</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {lang === "hu" ? "Adatvédelem" : "Privacy"}</span>
          </div>
          <div className={`flex items-center gap-4 text-sm ${isDark ? "text-white/30" : "text-gray-400"}`}>
            <Link href="/bejelentkezes" className={`transition-colors ${isDark ? "hover:text-white/60" : "hover:text-gray-600"}`}>
              {lang === "hu" ? "Bejelentkezés" : "Login"}
            </Link>
            <Link href="/regisztracio" className={`transition-colors ${isDark ? "hover:text-white/60" : "hover:text-gray-600"}`}>
              {lang === "hu" ? "Regisztráció" : "Register"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
