import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { G2ALogoOnDark } from "@/components/G2ALogo";

/**
 * Login — QA-token migrated (2026-06)
 *
 * A shadcn Card/Button/Input/Label komponensek defaultjukban már a Quiet
 * Authority tokenekhez vannak kötve (index.css: --card, --border, --primary
 * → --qa-surface, --qa-border, --qa-accent). Ezért NE adjunk explicit
 * bg-white/[0.03], text-violet-400 hardcode-okat — a bare shadcn magától
 * konzisztens a dashboarddal. Csak a hero (page bg) marad var(--qa-bg).
 */
export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const login = trpc.appAuth.login.useMutation({
    onSuccess: async (data) => {
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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--qa-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <G2ALogoOnDark size="lg" asLink />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-center" style={{ color: "var(--qa-fg)" }}>Üdvözlünk vissza</CardTitle>
            <CardDescription className="text-center" style={{ color: "var(--qa-fg3)" }}>
              Jelentkezz be a fiókodba
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label className="text-sm" style={{ color: "var(--qa-fg2)" }}>Email cím</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@ceg.hu"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm" style={{ color: "var(--qa-fg2)" }}>Jelszó</Label>
                  <Link href="/elfelejtett-jelszo" className="text-xs transition-colors" style={{ color: "var(--qa-accent)" }}>
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--qa-fg4)" }}
                    aria-label={showPass ? "Jelszó elrejtése" : "Jelszó mutatása"}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={login.isPending}
                className="w-full h-11"
              >
                {login.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Bejelentkezés...</>
                ) : (
                  "Bejelentkezés"
                )}
              </Button>

              <p className="text-center text-sm" style={{ color: "var(--qa-fg4)" }}>
                Még nincs fiókod?{" "}
                <Link href="/regisztracio" className="transition-colors" style={{ color: "var(--qa-accent)" }}>
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
