import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Compass } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4"
      style={{ background: "var(--qa-bg, #0f0f1a)" }}
    >
      <Card
        className="w-full max-w-lg border-0"
        style={{
          background: "var(--qa-surface, #1a1a2e)",
          border: "1px solid var(--qa-border, rgba(139, 92, 246, 0.15))",
        }}
      >
        <CardContent className="pt-10 pb-10 text-center">
          <div className="flex justify-center mb-6">
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(139, 92, 246, 0.1)" }}
            >
              <Compass className="w-8 h-8" style={{ color: "var(--qa-accent, #8b5cf6)" }} />
            </div>
          </div>

          <h1
            className="text-5xl font-bold mb-3"
            style={{ color: "var(--qa-fg, #ffffff)", fontFamily: "Sora, sans-serif" }}
          >
            404
          </h1>

          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: "var(--qa-fg, #ffffff)" }}
          >
            Az oldal nem található
          </h2>

          <p className="mb-8 leading-relaxed" style={{ color: "var(--qa-muted, #9ca3af)" }}>
            Sajnos a keresett oldal nem létezik vagy elköltözött.
            <br />
            Térj vissza a vezérlőpultra a folytatáshoz.
          </p>

          <Button
            onClick={() => setLocation("/")}
            className="px-6 py-2.5"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#ffffff",
            }}
          >
            <Home className="w-4 h-4 mr-2" />
            Vissza a főoldalra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
