import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft, Sparkles, Rocket, Building2, Check, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "free",
    name: "Ingyenes",
    price: "0 Ft",
    period: "/hó",
    icon: Sparkles,
    color: "oklch(0.65 0.15 240)",
    description: "Ismerkedj meg a platformmal — bankkártya nélkül",
    features: ["1 vállalkozás profil", "1 stratégia generálása / hó", "5 poszt generálása / hó", "1 SEO audit / hó", "Alapanalitika"],
    cta: "Ingyenes próba",
    popular: false,
    disabled: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 900 Ft",
    period: "/hó",
    icon: Rocket,
    color: "oklch(0.6 0.2 255)",
    description: "Kis vállalkozásoknak",
    features: ["1 vállalkozás profil", "5 stratégia generálása / hó", "50 poszt generálása / hó", "3 SEO audit / hó", "Lead & kampány kezelés", "Analitika export"],
    cta: "Starter indítása",
    popular: true,
    disabled: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "24 900 Ft",
    period: "/hó",
    icon: Building2,
    color: "oklch(0.7 0.18 165)",
    description: "Növekvő vállalkozásoknak",
    features: ["3 vállalkozás profil", "300 szöveg generálása / hó", "30 kép generálása / hó", "5 HeyGen videó / hó", "10 SEO audit / hó", "Prioritásos támogatás"],
    cta: "Pro indítása",
    popular: false,
    disabled: false,
  },
  {
    id: "agency",
    name: "Agency",
    price: "49 900 Ft",
    period: "/hó",
    icon: Crown,
    color: "oklch(0.75 0.18 75)",
    description: "Marketing ügynökségeknek — egyedi elbírálással",
    features: ["Korlátlan projekt", "1 000 szöveg generálása / hó", "100 kép generálása / hó", "15 HeyGen videó / hó", "30 SEO audit / hó", "White-label lehetőség", "Dedikált támogatás"],
    cta: "Vedd fel a kapcsolatot",
    popular: false,
    disabled: true,
  },
] as const;

const ANNUAL_PRICES: Record<string, string> = {
  free:    "0 Ft",
  starter: "99 000 Ft",
  pro:     "249 000 Ft",
  agency:  "499 000 Ft",
};
const ANNUAL_MONTHLY_EQUIV: Record<string, string> = {
  free:    "0 Ft/hó",
  starter: "8 250 Ft/hó",
  pro:     "20 750 Ft/hó",
  agency:  "41 583 Ft/hó",
};

type PlanId = typeof PLANS[number]["id"];

export default function Register() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"plan" | "form">("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("starter");
  const [isYearly, setIsYearly] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [newsletterConsent, setNewsletterConsent] = useState(true);

  const register = trpc.appAuth.register.useMutation({
    onSuccess: (data) => {
      if (data.user.onboardingCompleted) {
        navigate("/iranyitopult");
      } else {
        navigate("/onboarding");
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("A két jelszó nem egyezik meg.");
      return;
    }
    register.mutate({
      email,
      password,
      name: name || undefined,
      subscriptionPlan: selectedPlan,
      subscriptionBilling: isYearly && selectedPlan !== "free" ? "yearly" : "monthly",
      newsletterConsent,
    });
  };

  const passwordStrength = password.length >= 8 ? (
    password.match(/[A-Z]/) && password.match(/[0-9]/) ? "erős" : "közepes"
  ) : password.length > 0 ? "gyenge" : "";

  const activePlan = PLANS.find(p => p.id === selectedPlan)!;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-12 bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border-r border-white/5">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">G2A Growth Engine</span>
          </div>
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-white mb-6 leading-tight">
            Indítsd el a marketing<br />
            <span className="text-violet-400">növekedésedet</span> ma
          </h2>
          <div className="space-y-3">
            {[
              "AI-alapú marketing stratégia 5 perc alatt",
              "Tartalom gyártás és ütemezés egy helyen",
              "Lead kezelés és email kampányok",
              "Valós idejű analitika és KPI követés",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-sm">© 2025 G2A Marketing · Minden jog fenntartva</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl py-8">
          {/* Mobile logo */}
          <Link href="/">
            <div className="flex items-center gap-2 mb-8 lg:hidden cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg">G2A Growth Engine</span>
            </div>
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={cn("flex items-center gap-2 text-sm font-medium", step === "plan" ? "text-violet-400" : "text-white/40")}>
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", step === "plan" ? "bg-violet-600 text-white" : "bg-white/10 text-white/40")}>
                {step === "form" ? <Check className="w-3 h-3" /> : "1"}
              </div>
              Csomag választás
            </div>
            <div className="flex-1 h-px bg-white/10" />
            <div className={cn("flex items-center gap-2 text-sm font-medium", step === "form" ? "text-violet-400" : "text-white/40")}>
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold", step === "form" ? "bg-violet-600 text-white" : "bg-white/10 text-white/40")}>
                2
              </div>
              Fiók adatok
            </div>
          </div>

          {/* Step 1: Plan selection */}
          {step === "plan" && (
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Válassz csomagot</h1>
              <p className="text-white/50 mb-4 text-sm">Bármikor válthat csomagot. Az ingyenes csomaggal is elindulhat.</p>

              {/* Éves/havi kapcsoló */}
              <div className="flex justify-center mb-6">
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
              </div>

              {/* Ingyenes csomag — külön kiemelt sorban */}
              <div className="mb-3">
                {(() => {
                  const freePlan = PLANS.find(p => p.id === "free")!;
                  const Icon = freePlan.icon;
                  const isSelected = selectedPlan === "free";
                  return (
                    <button
                      onClick={() => setSelectedPlan("free")}
                      className={cn(
                        "relative w-full text-left p-5 rounded-xl border transition-all",
                        isSelected
                          ? "border-violet-500/60 bg-violet-500/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="flex items-start gap-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${freePlan.color}22` }}>
                          <Icon className="w-6 h-6" style={{ color: freePlan.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-3 mb-1">
                            <p className="font-bold text-white text-lg">{freePlan.name}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "oklch(0.65 0.18 165 / 25%)", color: "oklch(0.65 0.18 165)" }}>
                              Bankkártya nélkül
                            </span>
                          </div>
                          <p className="text-white/50 text-sm mb-2">{freePlan.description}</p>
                          <ul className="flex flex-wrap gap-x-4 gap-y-1">
                            {freePlan.features.map((f) => (
                              <li key={f} className="flex items-center gap-1.5 text-xs text-white/60">
                                <Check className="w-3 h-3 text-violet-400 shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-white">{freePlan.price}</div>
                          <div className="text-white/40 text-xs">{freePlan.period}</div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* "VAGY VÁLASSZ FIZETŐS CSOMAGOT" elválasztó */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs uppercase tracking-wider text-white/30">vagy válassz fizetős csomagot</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* 3 fizetős csomag egy sorban */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {PLANS.filter(p => p.id !== "free").map((plan) => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlan === plan.id;
                  const isDisabled = plan.disabled;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => !isDisabled && setSelectedPlan(plan.id)}
                      disabled={isDisabled}
                      className={cn(
                        "relative text-left p-5 rounded-xl border transition-all",
                        isDisabled
                          ? "border-white/[0.05] bg-white/[0.01] opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "border-violet-500/60 bg-violet-500/10"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      {plan.popular && !isDisabled && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600">
                          Legnépszerűbb
                        </div>
                      )}
                      {isDisabled && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white/80 bg-white/10 border border-white/20">
                          Hamarosan
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${plan.color}22` }}>
                          <Icon className="w-4 h-4" style={{ color: plan.color }} />
                        </div>
                        {isSelected && !isDisabled && (
                          <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-white text-base mb-0.5">{plan.name}</p>
                      <p className="text-white/40 text-xs mb-3">{plan.description}</p>
                      <motion.div
                        key={isYearly ? "yearly" : "monthly"}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4"
                      >
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-white">
                            {isYearly ? ANNUAL_PRICES[plan.id] ?? plan.price : plan.price}
                          </span>
                          <span className="text-white/40 text-xs">
                            {isYearly ? "/év" : plan.period}
                          </span>
                        </div>
                        {isYearly && (
                          <p className="text-xs mt-0.5" style={{ color: "oklch(0.65 0.18 165)" }}>
                            {ANNUAL_MONTHLY_EQUIV[plan.id]} – 2 hónap ingyen
                          </p>
                        )}
                      </motion.div>
                      <ul className="space-y-1.5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                            <Check className="w-3 h-3 text-violet-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <Button
                onClick={() => setStep("form")}
                disabled={activePlan.disabled}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activePlan.disabled
                  ? "Az Agency csomag csak egyedi elbírálással elérhető"
                  : `Folytatás: ${activePlan.name} csomag →`}
              </Button>

              <p className="text-center text-sm text-white/40 mt-4">
                Már van fiókod?{" "}
                <Link href="/bejelentkezes" className="text-violet-400 hover:text-violet-300 transition-colors">
                  Jelentkezz be
                </Link>
              </p>
            </div>
          )}

          {/* Step 2: Registration form */}
          {step === "form" && (
            <div>
              <button
                onClick={() => setStep("plan")}
                className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Vissza a csomag választáshoz
              </button>

              {/* Selected plan summary */}
              <div className="flex items-center gap-3 p-4 rounded-xl border border-violet-500/30 bg-violet-500/8 mb-6">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${activePlan.color}22` }}>
                  {(() => { const Icon = activePlan.icon; return <Icon className="w-4 h-4" style={{ color: activePlan.color }} />; })()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{activePlan.name} csomag kiválasztva</p>
                  <p className="text-white/50 text-xs">
                    {isYearly && activePlan.id !== "free"
                      ? `${ANNUAL_PRICES[activePlan.id]}/év (${ANNUAL_MONTHLY_EQUIV[activePlan.id]} – 2 hónap ingyen)`
                      : `${activePlan.price}${activePlan.period}`
                    } · {activePlan.description}
                  </p>
                </div>
                <button onClick={() => setStep("plan")} className="ml-auto text-xs text-violet-400 hover:text-violet-300">Módosít</button>
              </div>

              <h1 className="text-2xl font-bold text-white mb-2">Fiók létrehozása</h1>
              <p className="text-white/50 mb-6 text-sm">Regisztrálj és 5 perc alatt készen áll a stratégiád</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert className="bg-red-500/10 border-red-500/20 text-red-400">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Neved (opcionális)</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Pl. Kovács Péter"
                    className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Email cím *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@ceg.hu"
                    required
                    className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Jelszó *</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Legalább 8 karakter"
                      required
                      minLength={8}
                      className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordStrength && (
                    <p className={`text-xs ${
                      passwordStrength === "erős" ? "text-green-400" :
                      passwordStrength === "közepes" ? "text-yellow-400" : "text-red-400"
                    }`}>
                      Jelszó erőssége: {passwordStrength}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Jelszó megerősítése *</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Írja be mégegyszer a jelszót"
                      required
                      className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400">A két jelszó nem egyezik meg</p>
                  )}
                  {confirmPassword && password === confirmPassword && confirmPassword.length >= 8 && (
                    <p className="text-xs text-green-400">✓ A jelszók egyeznek</p>
                  )}
                </div>

                {/* Newsletter consent */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    onClick={() => setNewsletterConsent(v => !v)}
                    className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                    style={{
                      background: newsletterConsent ? "oklch(0.65 0.22 290)" : "transparent",
                      borderColor: newsletterConsent ? "oklch(0.65 0.22 290)" : "oklch(1 0 0 / 20%)",
                    }}
                  >
                    {newsletterConsent && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors leading-relaxed">
                    Feliratkozom a G2A Growth Engine hírlevelére – tippeket, stratégiai tartalmakat és exkluzív ajánlatokat kapok e-mailben. Bármikor leiratkozhatok.
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={register.isPending}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11"
                >
                  {register.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Regisztráció...</>
                  ) : (
                    `${activePlan.name}${isYearly && activePlan.id !== "free" ? " (éves)" : ""} fiók létrehozása`
                  )}
                </Button>

                <p className="text-center text-sm text-white/40">
                  Már van fiókod?{" "}
                  <Link href="/bejelentkezes" className="text-violet-400 hover:text-violet-300 transition-colors">
                    Jelentkezz be
                  </Link>
                </p>
              </form>
            </div>
          )}

          <p className="text-center text-xs text-white/20 mt-6">
            A regisztrációval elfogadod az{" "}
            <span className="text-white/40">Általános Szerződési Feltételeket</span>{" "}
            és az{" "}
            <span className="text-white/40">Adatvédelmi Szabályzatot</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
