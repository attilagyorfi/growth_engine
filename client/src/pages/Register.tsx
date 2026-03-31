import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Register() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

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
    register.mutate({ email, password, name: name || undefined });
  };

  const passwordStrength = password.length >= 8 ? (
    password.match(/[A-Z]/) && password.match(/[0-9]/) ? "erős" : "közepes"
  ) : password.length > 0 ? "gyenge" : "";

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border-r border-white/5">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">G2A Growth Engine</span>
          </div>
        </Link>
        <div>
          <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
            Indítsd el a marketing<br />
            <span className="text-violet-400">növekedésedet</span> ma
          </h2>
          <div className="space-y-4">
            {[
              "AI-alapú marketing stratégia 5 perc alatt",
              "Tartalom gyártás és ütemezés egy helyen",
              "Lead kezelés és email kampányok",
              "Valós idejű analitika és KPI követés",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-white/70">
                <CheckCircle2 className="w-5 h-5 text-violet-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/30 text-sm">© 2025 G2A Marketing · Minden jog fenntartva</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/">
            <div className="flex items-center gap-2 mb-8 lg:hidden cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg">G2A Growth Engine</span>
            </div>
          </Link>

          <Card className="bg-white/[0.03] border-white/[0.08]">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-white">Ingyenes fiók létrehozása</CardTitle>
              <CardDescription className="text-white/50">
                Regisztrálj és 5 perc alatt készen áll a stratégiád
              </CardDescription>
            </CardHeader>
            <CardContent>
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

                <Button
                  type="submit"
                  disabled={register.isPending}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11"
                >
                  {register.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Regisztráció...</>
                  ) : (
                    "Fiók létrehozása"
                  )}
                </Button>

                <p className="text-center text-sm text-white/40">
                  Már van fiókod?{" "}
                  <Link href="/bejelentkezes" className="text-violet-400 hover:text-violet-300 transition-colors">
                    Jelentkezz be
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>

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
