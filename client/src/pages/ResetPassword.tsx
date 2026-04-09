import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Loader2, CheckCircle2, ArrowLeft, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

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

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
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
            <CardTitle className="text-2xl text-white text-center">Új jelszó beállítása</CardTitle>
            <CardDescription className="text-white/50 text-center">
              Add meg az új jelszavadat
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="text-center py-4">
                <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">Érvénytelen link</h3>
                <p className="text-white/50 text-sm mb-6">
                  Ez a visszaállítási link érvénytelen vagy lejárt. Kérj új jelszó-visszaállítási emailt.
                </p>
                <Link href="/elfelejtett-jelszo">
                  <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                    Új link kérése
                  </Button>
                </Link>
              </div>
            ) : success ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">Jelszó sikeresen megváltoztatva!</h3>
                <p className="text-white/50 text-sm mb-6">
                  Átirányítunk a bejelentkezési oldalra...
                </p>
                <Link href="/bejelentkezes">
                  <Button className="bg-violet-600 hover:bg-violet-500 text-white border-0">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Bejelentkezés
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert className="bg-red-500/10 border-red-500/20 text-red-400">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Új jelszó</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Legalább 8 karakter"
                      required
                      minLength={8}
                      className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/70 text-sm">Jelszó megerősítése</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Írd be újra a jelszót"
                      required
                      className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">A két jelszó nem egyezik</p>
                  )}
                </div>

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= i * 3
                              ? i <= 1 ? "bg-red-500" : i <= 2 ? "bg-yellow-500" : i <= 3 ? "bg-blue-500" : "bg-green-500"
                              : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-white/30 text-xs">
                      {password.length < 8 ? "Túl rövid" : password.length < 10 ? "Gyenge" : password.length < 12 ? "Közepes" : "Erős"}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={resetPassword.isPending || !password || !confirmPassword}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11"
                >
                  {resetPassword.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mentés...</>
                  ) : (
                    "Jelszó megváltoztatása"
                  )}
                </Button>

                <Link href="/bejelentkezes">
                  <Button variant="ghost" className="w-full text-white/40 hover:text-white/70">
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
