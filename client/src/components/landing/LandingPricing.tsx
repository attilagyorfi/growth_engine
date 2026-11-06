/**
 * G2A Growth Engine – Landing árazási szekció
 * A pilotig rejtve: a Landing.tsx SHOW_PRICING kapcsolójával jeleníthető meg újra.
 */

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle2, Sparkles, Rocket, Building2, Crown } from "lucide-react";
import PricingMatrix from "@/components/PricingMatrix";
import FadeIn from "@/components/landing/FadeIn";

// ─── Shared Plans (synced with Register.tsx) ──────────────────────────────────
// Színkódok minden csomaghoz — vizuális különbségtétel a választás megkönnyítésére.
// A Tailwind classes string-ek a tartós (build-time) stílusokhoz, az accent
// objektum CSS color literal-ekkel a finomabb alkalmazáshoz (badge, border, glow).
const PLANS = [
  {
    id: "free",
    name: "Ingyenes",
    price: "0 Ft",
    period: "/hó",
    icon: Sparkles,
    description: "Ismerkedj meg a platformmal — bankkártya nélkül",
    features: ["1 vállalkozás profil", "1 stratégia generálása / hó", "5 poszt generálása / hó", "1 SEO audit / hó", "Alapanalitika (export nélkül)"],
    cta: "Kezdd el ingyen",
    popular: false,
    disabled: false,
    accent: { color: "#60a5fa", glow: "rgba(96,165,250,0.12)" }, // blue-400
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 900 Ft",
    period: "/hó",
    icon: Rocket,
    description: "Kis vállalkozásoknak",
    features: ["1 vállalkozás profil", "5 stratégia generálása / hó", "50 poszt generálása / hó", "3 SEO audit / hó", "Lead & kampány kezelés", "Analitika export"],
    cta: "Starter indítása",
    popular: true,
    disabled: false,
    accent: { color: "#a78bfa", glow: "rgba(167,139,250,0.18)" }, // violet-400
  },
  {
    id: "pro",
    name: "Pro",
    price: "24 900 Ft",
    period: "/hó",
    icon: Building2,
    description: "Növekvő vállalkozásoknak",
    features: ["3 vállalkozás profil", "300 szöveg generálása / hó", "30 kép generálása / hó", "5 HeyGen videó / hó", "10 SEO audit / hó", "Prioritásos támogatás"],
    cta: "Pro indítása",
    popular: false,
    disabled: false,
    accent: { color: "#34d399", glow: "rgba(52,211,153,0.15)" }, // emerald-400
  },
  {
    id: "agency",
    name: "Agency",
    price: "49 900 Ft",
    period: "/hó",
    icon: Crown,
    description: "Marketing ügynökségeknek — egyedi elbírálással",
    features: ["Korlátlan projekt", "1 000 szöveg generálása / hó", "100 kép generálása / hó", "15 HeyGen videó / hó", "30 SEO audit / hó", "White-label lehetőség", "Dedikált támogatás"],
    cta: "Vedd fel a kapcsolatot",
    popular: false,
    disabled: true,
    accent: { color: "#fbbf24", glow: "rgba(251,191,36,0.15)" }, // amber-400
  },
] as const;

// ─── Annual prices (10 months = 2 months free) ───────────────────────────────
const ANNUAL_PRICES: Record<string, string> = {
  free: "0 Ft", starter: "99 000 Ft", pro: "249 000 Ft", agency: "499 000 Ft",
};
const ANNUAL_MONTHLY_EQUIV: Record<string, string> = {
  free: "0 Ft/hó", starter: "8 250 Ft/hó", pro: "20 750 Ft/hó", agency: "41 583 Ft/hó",
};

export default function LandingPricing() {
  const [isYearly, setIsYearly] = useState(false);

  const subtext = "text-white/50";

  return (
    <section id="pricing" className="py-24 px-6 bg-white/[0.02]">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Egyszerű árazás
          </h2>
          <p className={`text-lg mb-8 ${subtext}`}>
            Kezdd el ingyen, fejlődj velünk!
          </p>
          {/* Éves/havi kapcsoló */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => setIsYearly(false)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={!isYearly ? { background: "var(--qa-accent)", color: "white" } : { color: "rgba(255,255,255,0.45)" }}
            >
              Havi
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
              style={isYearly ? { background: "var(--qa-accent)", color: "white" } : { color: "rgba(255,255,255,0.45)" }}
            >
              Éves
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "oklch(0.65 0.18 165 / 30%)", color: "oklch(0.65 0.18 165)" }}>
                -17%
              </span>
            </button>
          </div>
        </FadeIn>
        {/* Ingyenes csomag — vertikális kártya, max-width center-elve, accent színnel */}
        {(() => {
          const freePlan = PLANS.find(p => p.id === "free")!;
          return (
            <FadeIn>
              <div className="max-w-md mx-auto mb-2">
                <Card
                  className="h-full relative overflow-hidden transition-transform duration-300 hover:scale-[1.03]"
                  style={{
                    background: `${freePlan.accent.glow}`,
                    borderColor: `${freePlan.accent.color}50`,
                  }}
                >
                  <div className="absolute top-4 right-4">
                    <Badge className="border-0 text-xs" style={{ background: freePlan.accent.color, color: "#0A0A0F" }}>
                      Bankkártya nélkül
                    </Badge>
                  </div>
                  <CardContent className="p-8">
                    <div className="mb-6">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${freePlan.accent.color}1f` }}>
                        <freePlan.icon className="w-5 h-5" style={{ color: freePlan.accent.color }} />
                      </div>
                      <h3 className="text-xl font-bold mb-1">{freePlan.name}</h3>
                      <div className="mb-1">
                        <div className="text-3xl font-bold">
                          {freePlan.price}
                          <span className={`text-base font-normal ml-1 ${subtext}`}>{freePlan.period}</span>
                        </div>
                      </div>
                      <p className={`text-sm ${subtext}`}>{freePlan.description}</p>
                    </div>
                    <ul className="space-y-2.5 mb-8">
                      {freePlan.features.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: freePlan.accent.color }} />
                          <span className={subtext}>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/regisztracio">
                      <Button
                        className="w-full border-0 text-white"
                        style={{ background: freePlan.accent.color, color: "#0A0A0F" }}
                      >
                        {freePlan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </FadeIn>
          );
        })()}

        {/* "VAGY VÁLASSZ FIZETŐS CSOMAGOT" elválasztó */}
        <div className="flex items-center gap-3 my-8">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs uppercase tracking-wider text-white/40">vagy válassz fizetős csomagot</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* 3 fizetős csomag — egyedi színkóddal mindegyik */}
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.filter(p => p.id !== "free").map((plan, i) => (
            <FadeIn key={plan.id} delay={i * 0.1}>
              <Card
                className={`h-full relative overflow-hidden transition-transform duration-300 ${
                  plan.disabled ? "opacity-60" : "hover:scale-[1.03]"
                }`}
                style={{
                  background: plan.accent.glow,
                  borderColor: `${plan.accent.color}50`,
                }}
              >
                {plan.popular && !plan.disabled && (
                  <div className="absolute top-4 right-4">
                    <Badge className="border-0 text-xs" style={{ background: plan.accent.color, color: "#0A0A0F" }}>
                      Legnépszerűbb
                    </Badge>
                  </div>
                )}
                {plan.disabled && (
                  <div className="absolute top-4 right-4">
                    <Badge className="border-0 text-xs" style={{ background: `${plan.accent.color}40`, color: plan.accent.color }}>
                      Hamarosan
                    </Badge>
                  </div>
                )}
                <CardContent className="p-8">
                  <div className="mb-6">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${plan.accent.color}1f` }}>
                      <plan.icon className="w-5 h-5" style={{ color: plan.accent.color }} />
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
                        {isYearly ? ANNUAL_PRICES[plan.id] ?? plan.price : plan.price}
                        {isYearly ? (
                          <span className={`text-base font-normal ml-1 ${subtext}`}>/év</span>
                        ) : (
                          <span className={`text-base font-normal ml-1 ${subtext}`}>{plan.period}</span>
                        )}
                      </div>
                      {isYearly && (
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
                        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: plan.accent.color }} />
                        <span className={subtext}>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.disabled ? (
                    <Button disabled className="w-full bg-white/5 text-white/40 border-0 cursor-not-allowed">
                      {plan.cta}
                    </Button>
                  ) : (
                    <Link href="/regisztracio">
                      <Button
                        className="w-full border-0 text-white"
                        style={{ background: plan.accent.color, color: "#0A0A0F" }}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>

        {/* Feature-mátrix — részletes összehasonlítás a kártyák alatt */}
        <FadeIn delay={0.1} className="mt-16">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-2">Csomag-összehasonlítás</h3>
            <p className={`text-sm ${subtext}`}>
              Minden funkció és korlát egy táblázatban — hogy pontosan lásd, melyik csomag felel meg a legjobban.
            </p>
          </div>
          <PricingMatrix />
        </FadeIn>
      </div>
    </section>
  );
}
