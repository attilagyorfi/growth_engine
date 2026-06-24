/**
 * Newsletter – főmenüpont (super_admin only)
 *
 * Korábban a Beállítások → Hírlevél tab alatt volt; átkerült a sidebar fő
 * menübe, hogy a hírlevél-küldés gyorsabban elérhető legyen.
 * A kampány-szerkesztő és a feliratkozó-lista logikáját a
 * NewsletterSection komponens tartalmazza (változatlan).
 */
import DashboardLayout from "@/components/DashboardLayout";
import NewsletterSection from "@/components/settings/NewsletterSection";
import { Send } from "lucide-react";

export default function Newsletter() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "oklch(0.6 0.2 255 / 15%)" }}
          >
            <Send size={20} style={{ color: "oklch(0.75 0.2 255)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--qa-fg)", fontFamily: "Sora, sans-serif" }}
            >
              Hírlevél
            </h1>
            <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>
              Feliratkozók kezelése és kampányok küldése
            </p>
          </div>
        </div>
        <NewsletterSection />
      </div>
    </DashboardLayout>
  );
}
