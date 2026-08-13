import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { G2ALogoOnDark } from "@/components/G2ALogo";

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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--qa-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <G2ALogoOnDark size="lg" asLink />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-center" style={{ color: "var(--qa-fg)" }}>Elfelejtett jelszó</CardTitle>
            <CardDescription className="text-center" style={{ color: "var(--qa-fg3)" }}>
              Add meg az email címedet és küldünk egy visszaállítási linket
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--qa-success)" }} />
                <h3 className="font-semibold mb-2" style={{ color: "var(--qa-fg)" }}>Email elküldve!</h3>
                <p className="text-sm mb-6" style={{ color: "var(--qa-fg3)" }}>
                  Ha ez az email cím regisztrált, hamarosan megkapod a visszaállítási linket.
                </p>
                <Link href="/bejelentkezes">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Vissza a bejelentkezéshez
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
                  <Label className="text-sm" style={{ color: "var(--qa-fg2)" }}>Email cím</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@ceg.hu"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={forgotPassword.isPending}
                  className="w-full h-11"
                >
                  {forgotPassword.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Küldés...</>
                  ) : (
                    "Visszaállítási link küldése"
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
