/**
 * Newsletter – főmenüpont (super_admin only)
 *
 * Korábban a Beállítások → Hírlevél tab alatt volt; átkerült a sidebar fő
 * menübe, hogy a hírlevél-küldés gyorsabban elérhető legyen.
 * A kampány-szerkesztő és a feliratkozó-lista logikáját a
 * NewsletterSection komponens tartalmazza (változatlan).
 * G0: a küldés kapcsolóval befagyasztva (newsletter.isEnabled) — a küldés gombot
 * a NewsletterSection tiltja le, itt csak az alcím jelzi.
 */
import DashboardLayout from "@/components/DashboardLayout";
import NewsletterSection from "@/components/settings/NewsletterSection";
import { trpc } from "@/lib/trpc";
import { Send } from "lucide-react";

export default function Newsletter() {
  const { data: flag } = trpc.newsletter.isEnabled.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "var(--qa-accent-soft)" }}
          >
            <Send size={20} style={{ color: "oklch(0.75 0.2 255)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--qa-fg)", fontFamily: "var(--font-heading)" }}
            >
              Hírlevél
            </h1>
            <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>
              {flag && !flag.enabled
                ? "Feliratkozók kezelése – a küldés egyelőre szünetel"
                : "Feliratkozók kezelése és kampányok küldése"}
            </p>
          </div>
        </div>
        <NewsletterSection />
      </div>
    </DashboardLayout>
  );
}
