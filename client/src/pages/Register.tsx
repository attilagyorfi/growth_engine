import { useState } from "react";
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
    description: "Ismerkedj meg a platformmal",
    features: ["1 vállalkozás profil", "1 AI stratégia/hó", "5 AI poszt/hó", "1 SEO audit/hó", "Alapanalitika"],
    cta: "Ingyenes próba",
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "9 900 Ft",
    period: "/hó",
    icon: Rocket,
    color: "oklch(0.6 0.2 255)",
    description: "Kis vállalkozásoknak",
    features: ["1 vállalkozás profil", "5 AI stratégia/hó", "50 AI poszt/hó", "3 SEO audit/hó", "Lead & kampány kezelés", "Analitika export"],
    cta: "Starter indítása",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "24 900 Ft",
    period: "/hó",
    icon: Building2,
    color: "oklch(0.7 0.18 165)",
    description: "Növekvő vállalkozásoknak",
    features: ["3 vállalkozás profil", "300 AI szöveges/hó", "30 AI kép/hó", "5 HeyGen AI videó/hó", "10 SEO audit/hó", "Prioritásos támogatás"],
    cta: "Pro indítása",
    popular: false,
  },
  {
    id: "agency",
    name: "Agency",
    price: "49 900 Ft",
    period: "/hó",
    icon: Crown,
    color: "oklch(0.75 0.18 75)",
    description: "Marketing ügynökségeknek",
    features: ["Korlátlan projekt", "1 000 AI szöveges/hó", "100 AI kép/hó", "15 HeyGen AI videó/hó", "30 SEO audit/hó", "White-label lehetőség", "Dedikált támogatás"],
    cta: "Agency indítása",
    popular: false,
  },
] as const;

type PlanId = typeof PLANS[number]["id"];

export default function Register() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"plan" | "form">("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("starter");
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
    register.mutate({ email, password, name: name || undefined, subscriptionPlan: selectedPlan, newsletterConsent });
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
              <p className="text-white/50 mb-6 text-sm">Bármikor válthat csomagot. Az ingyenes csomaggal is elindulhat.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {PLANS.map((plan) => {
                  const Icon = plan.icon;
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={cn(
                        "relative text-left p-5 rounded-xl border transition-all",
                        isSelected
                          ? "border-violet-500/60 bg-violet-500/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                      )}
                    >
                      {plan.popular && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600">
                          Legnépszerűbb
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${plan.color}22` }}>
                          <Icon className="w-4 h-4" style={{ color: plan.color }} />
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="font-bold text-white text-base mb-0.5">{plan.name}</p>
                      <p className="text-white/40 text-xs mb-3">{plan.description}</p>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-xl font-bold text-white">{plan.price}</span>
                        <span className="text-white/40 text-xs">{plan.period}</span>
                      </div>
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
                className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11"
              >
                Folytatás: {activePlan.name} csomag →
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
                  <p className="text-white/50 text-xs">{activePlan.price}{activePlan.period} · {activePlan.description}</p>
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
                    `${activePlan.name} fiók létrehozása`
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
