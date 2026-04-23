import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const login = trpc.appAuth.login.useMutation({
    onSuccess: async (data) => {
      // Invalidate auth cache so AppRoute/OnboardingRoute guards get fresh data
      await utils.appAuth.me.invalidate();
      if (!data.user.onboardingCompleted) {
        navigate("/onboarding");
      } else {
        navigate("/iranyitopult");
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ email, password });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/">
          <div className="flex items-center gap-2 mb-8 justify-center cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">G2A Growth Engine</span>
          </div>
        </Link>

        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-white text-center">Üdvözlünk vissza</CardTitle>
            <CardDescription className="text-white/50 text-center">
              Jelentkezz be a fiókodba
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
                <Label className="text-white/70 text-sm">Email cím</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@ceg.hu"
                  required
                  autoComplete="email"
                  className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-white/70 text-sm">Jelszó</Label>
                  <Link href="/elfelejtett-jelszo" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    Elfelejtett jelszó?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Jelszó"
                    required
                    autoComplete="current-password"
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
              </div>

              <Button
                type="submit"
                disabled={login.isPending}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11"
              >
                {login.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Bejelentkezés...</>
                ) : (
                  "Bejelentkezés"
                )}
              </Button>

              <p className="text-center text-sm text-white/40">
                Még nincs fiókod?{" "}
                <Link href="/regisztracio" className="text-violet-400 hover:text-violet-300 transition-colors">
                  Regisztrálj ingyen
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
