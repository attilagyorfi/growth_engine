import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const forgotPassword = trpc.appAuth.forgotPassword.useMutation({
    onSuccess: () => setSent(true),
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    forgotPassword.mutate({ email });
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
            <CardTitle className="text-2xl text-white text-center">Elfelejtett jelszó</CardTitle>
            <CardDescription className="text-white/50 text-center">
              Add meg az email címedet és küldünk egy visszaállítási linket
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">Email elküldve!</h3>
                <p className="text-white/50 text-sm mb-6">
                  Ha ez az email cím regisztrált, hamarosan megkapod a visszaállítási linket.
                </p>
                <Link href="/bejelentkezes">
                  <Button variant="outline" className="border-white/10 text-white/70 hover:text-white bg-transparent">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Vissza a bejelentkezéshez
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
                  <Label className="text-white/70 text-sm">Email cím</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@ceg.hu"
                    required
                    className="bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-violet-500/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={forgotPassword.isPending}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white border-0 h-11"
                >
                  {forgotPassword.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Küldés...</>
                  ) : (
                    "Visszaállítási link küldése"
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
