import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, ArrowLeft, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { G2ALogoOnDark } from "@/components/G2ALogo";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Extract token from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) setToken(t);
  }, []);

  const resetPassword = trpc.appAuth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => setLocation("/bejelentkezes"), 3000);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("A két jelszó nem egyezik");
      return;
    }
    if (password.length < 8) {
      setError("A jelszó legalább 8 karakter legyen");
      return;
    }
    if (!token) {
      setError("Érvénytelen visszaállítási link");
      return;
    }
    resetPassword.mutate({ token, newPassword: password });
  };

  // Jelszó-erősség indikátor színek — QA tokenek
  const strengthColor = (i: number) => {
    if (password.length < i * 3) return "var(--qa-border)";
    if (i <= 1) return "var(--qa-danger)";
    if (i <= 2) return "var(--qa-warning)";
    if (i <= 3) return "var(--qa-accent)";
    return "var(--qa-success)";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--qa-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <G2ALogoOnDark size="lg" asLink />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-center" style={{ color: "var(--qa-fg)" }}>Új jelszó beállítása</CardTitle>
            <CardDescription className="text-center" style={{ color: "var(--qa-fg3)" }}>
              Add meg az új jelszavadat
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="text-center py-4">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--qa-warning)" }} />
                <h3 className="font-semibold mb-2" style={{ color: "var(--qa-fg)" }}>Érvénytelen link</h3>
                <p className="text-sm mb-6" style={{ color: "var(--qa-fg3)" }}>
                  Ez a visszaállítási link érvénytelen vagy lejárt. Kérj új jelszó-visszaállítási emailt.
                </p>
                <Link href="/elfelejtett-jelszo">
                  <Button>Új link kérése</Button>
                </Link>
              </div>
            ) : success ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--qa-success)" }} />
                <h3 className="font-semibold mb-2" style={{ color: "var(--qa-fg)" }}>Jelszó sikeresen megváltoztatva!</h3>
                <p className="text-sm mb-6" style={{ color: "var(--qa-fg3)" }}>
                  Átirányítunk a bejelentkezési oldalra...
                </p>
                <Link href="/bejelentkezes">
                  <Button>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Bejelentkezés
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label className="text-sm" style={{ color: "var(--qa-fg2)" }}>Új jelszó</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Legalább 8 karakter"
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "var(--qa-fg4)" }}
                      aria-label={showPassword ? "Jelszó elrejtése" : "Jelszó mutatása"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm" style={{ color: "var(--qa-fg2)" }}>Jelszó megerősítése</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Írd be újra a jelszót"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "var(--qa-fg4)" }}
                      aria-label={showConfirm ? "Jelszó elrejtése" : "Jelszó mutatása"}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs mt-1" style={{ color: "var(--qa-danger)" }}>A két jelszó nem egyezik</p>
                  )}
                </div>

                {/* Password strength indicator — QA tokenek */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-colors"
                          style={{ background: strengthColor(i) }}
                        />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>
                      {password.length < 8 ? "Túl rövid" : password.length < 10 ? "Gyenge" : password.length < 12 ? "Közepes" : "Erős"}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={resetPassword.isPending || !password || !confirmPassword}
                  className="w-full h-11"
                >
                  {resetPassword.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mentés...</>
                  ) : (
                    "Jelszó megváltoztatása"
                  )}
                </Button>

                <Link href="/bejelentkezes">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Vissza a bejelentkezéshez
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
