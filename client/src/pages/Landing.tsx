import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3, Brain, Mail, Megaphone, Target, Users,
  CheckCircle2, ArrowRight, Zap, Shield, TrendingUp, Star
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-alapú Stratégia",
    desc: "Az AI elemzi a vállalkozásodat és teljes marketing stratégiát generál: célközönség, tartalom pillérek, havi prioritások.",
  },
  {
    icon: Megaphone,
    title: "Tartalom Studio",
    desc: "LinkedIn, Facebook, Instagram, TikTok – ütemezd, szerkeszd és hagyd jóvá a posztjaidat egy helyen.",
  },
  {
    icon: Mail,
    title: "Értékesítési Ops",
    desc: "Lead kezelés, kimenő email kampányok és beérkező válaszok nyomon követése egyetlen felületen.",
  },
  {
    icon: Target,
    title: "Vevői Intelligencia",
    desc: "Automatikus versenytárs elemzés, buyer persona generálás és márka DNA feltérképezés.",
  },
  {
    icon: BarChart3,
    title: "Analitika & KPI",
    desc: "Valós idejű teljesítmény mutatók, tartalom hatékonyság és lead konverzió nyomon követése.",
  },
  {
    icon: Users,
    title: "Ügyfél Workspace",
    desc: "Minden ügyfélnek saját, izolált munkaterülete van – az adataik biztonságban maradnak.",
  },
];

const steps = [
  { num: "01", title: "Regisztrálj", desc: "Hozz létre ingyenes fiókot 30 másodperc alatt." },
  { num: "02", title: "Onboarding", desc: "Az AI feltérképezi a vállalkozásodat és elkészíti a profilt." },
  { num: "03", title: "Stratégia", desc: "Kapj személyre szabott marketing stratégiát azonnal." },
  { num: "04", title: "Növekedj", desc: "Hajtsd végre a terveket és kövesd az eredményeket." },
];

const testimonials = [
  {
    name: "Kovács Péter",
    role: "Marketing igazgató",
    company: "TechStart Kft.",
    text: "A G2A Growth Engine teljesen átalakította a marketing folyamatainkat. 3 hónap alatt 40%-kal nőtt a lead generálásunk.",
    rating: 5,
  },
  {
    name: "Nagy Eszter",
    role: "Ügyvezető",
    company: "Prémium Ingatlan",
    text: "Az AI stratégia generáló hihetetlen. Ami korábban hetekig tartott, most percek alatt elkészül.",
    rating: 5,
  },
  {
    name: "Szabó Gábor",
    role: "Sales vezető",
    company: "B2B Solutions",
    text: "A Sales Ops modul forradalmasította az értékesítési folyamatainkat. Minden egy helyen, átláthatóan.",
    rating: 5,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">G2A Growth Engine</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Funkciók</a>
            <a href="#how" className="hover:text-white transition-colors">Hogyan működik</a>
            <a href="#pricing" className="hover:text-white transition-colors">Árazás</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/bejelentkezes">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
                Bejelentkezés
              </Button>
            </Link>
            <Link href="/regisztracio">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                Ingyenes próba
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <Badge className="mb-6 bg-violet-500/10 text-violet-300 border-violet-500/20 hover:bg-violet-500/10">
            🚀 AI-alapú marketing platform
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight">
            Marketing stratégia,{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              AI sebességgel
            </span>
          </h1>
          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            A G2A Growth Engine AI-alapú marketing operációs rendszer, amely segít a vállalkozásodnak
            stratégiát alkotni, tartalmat gyártani és leadeket generálni – mindezt egyetlen platformon.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/regisztracio">
              <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-8 h-12 text-base">
                Kezdj el ingyen <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 px-8 h-12 text-base bg-transparent">
                Tudj meg többet
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-white/30">Nincs szükség bankkártyára · Ingyenes csomag elérhető</p>
        </div>
      </section>

      {/* ─── Stats ───────────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { val: "10x", label: "Gyorsabb stratégia alkotás" },
            { val: "40%", label: "Több lead átlagosan" },
            { val: "5 perc", label: "Onboarding idő" },
            { val: "100%", label: "Magyar nyelvű" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-violet-400 mb-1">{stat.val}</div>
              <div className="text-sm text-white/40">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Minden, amire szükséged van</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Egy platform, amely lefedi a teljes marketing és értékesítési folyamatot – az ötlettől az eredményig.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] transition-colors group">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                    <f.icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Hogyan működik?</h2>
            <p className="text-white/50 text-lg">Négy egyszerű lépés a marketing sikerhez</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={step.num} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[60%] right-0 h-px bg-gradient-to-r from-violet-500/40 to-transparent" />
                )}
                <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4 text-violet-400 font-bold text-sm">
                  {step.num}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-white/40 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Mit mondanak ügyfeleink?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed mb-4">"{t.text}"</p>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-white/40 text-xs">{t.role}, {t.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Egyszerű árazás</h2>
            <p className="text-white/50 text-lg">Kezdj el ingyen, fejlődj velünk</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <Card className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">Ingyenes</h3>
                  <div className="text-4xl font-bold mb-2">0 Ft<span className="text-lg text-white/40 font-normal">/hó</span></div>
                  <p className="text-white/40 text-sm">Tökéletes az induláshoz</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "1 ügyfél profil",
                    "AI stratégia generálás",
                    "50 tartalom / hó",
                    "Lead kezelés",
                    "Alap analitika",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/regisztracio">
                  <Button className="w-full bg-white/10 hover:bg-white/15 text-white border-0">
                    Ingyenes regisztráció
                  </Button>
                </Link>
              </CardContent>
            </Card>
            {/* Pro */}
            <Card className="bg-violet-600/10 border-violet-500/30 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Badge className="bg-violet-500 text-white border-0 text-xs">Hamarosan</Badge>
              </div>
              <CardContent className="p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-1">Pro</h3>
                  <div className="text-4xl font-bold mb-2">
                    <span className="text-white/30 line-through text-2xl">49 990 Ft</span>
                    <span className="text-violet-400 ml-2">Hamarosan</span>
                  </div>
                  <p className="text-white/40 text-sm">Korlátlan növekedéshez</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Korlátlan ügyfél profil",
                    "Prioritásos AI generálás",
                    "Korlátlan tartalom",
                    "Email integráció",
                    "Haladó analitika",
                    "Csapat hozzáférés",
                    "Dedikált support",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button disabled className="w-full bg-violet-600/50 text-white/50 border-0 cursor-not-allowed">
                  Hamarosan elérhető
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-violet-400 mb-4">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Csatlakozz a növekvő vállalkozásokhoz</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Készen állsz a növekedésre?
          </h2>
          <p className="text-white/50 text-lg mb-10">
            Regisztrálj ingyen és 5 perc alatt készen áll a marketing stratégiád.
          </p>
          <Link href="/regisztracio">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-500 text-white border-0 px-10 h-14 text-lg">
              Kezdj el most – ingyen <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">G2A Growth Engine</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <span>© 2025 G2A Marketing</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Adatvédelem</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/30">
            <Link href="/bejelentkezes" className="hover:text-white/60 transition-colors">Bejelentkezés</Link>
            <Link href="/regisztracio" className="hover:text-white/60 transition-colors">Regisztráció</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
