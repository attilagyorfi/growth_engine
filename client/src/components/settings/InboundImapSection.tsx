/**
 * InboundImapSection – super_admin IMAP-szinkron panel
 *
 * A Settings → Admin tab-ba ágyazott blokk:
 *   • Mutatja, hogy az IMAP env vars be vannak-e állítva (host + user)
 *   • "Fetch most" gomb → meghívja az inbound.fetchNow tRPC mutation-t
 *     → az új UNSEEN leveleket lefetcheli + AI-kategorizál + DB-be menti.
 *     Az eredményt toast-tal mutatja.
 *
 * NEM jelöli SEEN-nek a leveleket a Gmail-ben — a user a Gmail-ben még
 * olvasatlanként látja, az appban viszont mostantól ott vannak az
 * Inbox oldalon (kategorizálva).
 *
 * Az AI-suggested válasz + jóváhagyás flow külön (a #6b PR-ben jön).
 */
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Inbox, RefreshCw, Loader2, Check, AlertCircle, Mail } from "lucide-react";

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";

export default function InboundImapSection() {
  const { data: status, isLoading } = trpc.inbound.getImapStatus.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();
  const fetchNow = trpc.inbound.fetchNow.useMutation({
    onSuccess: (result) => {
      if (result.error) {
        toast.error(`Hiba a szinkronizáció során: ${result.error}`);
        return;
      }
      // Frissítjük az inbox listáját az Inbox oldalon, ha betöltődött
      utils.inbound.list.invalidate().catch(() => { /* ignore */ });
      const messages: string[] = [];
      if (result.inserted > 0) messages.push(`${result.inserted} új levél`);
      if (result.skipped > 0) messages.push(`${result.skipped} már megvolt`);
      if (result.classificationFailures > 0) messages.push(`${result.classificationFailures} AI-besorolási hiba`);
      if (result.fetched === 0) {
        toast.success("Nincs új olvasatlan levél a Gmail INBOX-ban.");
      } else {
        toast.success(`✅ Szinkron kész — ${messages.join(", ")}.`, { duration: 6000 });
      }
    },
    onError: (err) => {
      toast.error(err.message ?? "Hiba a szinkronizáció során.");
    },
  });

  return (
    <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Inbox size={16} style={{ color: "var(--qa-accent-purple)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Bejövő email szinkron (IMAP)</h3>
        </div>
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--qa-fg4)" }} />
        ) : status?.configured ? (
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ background: "oklch(from var(--qa-success) l c h / 15%)", color: "var(--qa-success)" }}>
            <Check size={12} /> Csatlakozva
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ background: "oklch(from var(--qa-warning) l c h / 15%)", color: "var(--qa-warning)" }}>
            <AlertCircle size={12} /> Nincs konfigurálva
          </span>
        )}
      </div>

      <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
        Az IMAP-fiókba érkezett olvasatlan leveleket lefetcheljük, AI automatikusan
        kategorizálja, és a Sales / Inbox oldalon megjelennek. A Gmail-ben a levelek
        olvasatlanok maradnak — csak másoljuk, nem jelöljük SEEN-nek.
      </p>

      {/* Konfig sorok */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
          <Mail size={14} style={{ color: "var(--qa-fg4)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "var(--qa-fg2)" }}>Felhasználó (IMAP)</p>
            <p className="text-xs truncate" style={{ color: "var(--qa-fg4)" }}>
              {status?.user || "Állítsd be: INBOUND_IMAP_USER env"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--qa-surface2)" }}>
          <Mail size={14} style={{ color: "var(--qa-fg4)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: "var(--qa-fg2)" }}>Host</p>
            <p className="text-xs truncate" style={{ color: "var(--qa-fg4)" }}>
              {status?.host || "imap.gmail.com"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => fetchNow.mutate()}
          disabled={!status?.configured || fetchNow.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--qa-accent-purple)" }}
        >
          {fetchNow.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {fetchNow.isPending ? "Szinkron folyamatban..." : "Fetch most"}
        </button>
        {!status?.configured && (
          <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
            Állítsd be: INBOUND_IMAP_USER + INBOUND_IMAP_PASSWORD (Gmail: app-password)
          </span>
        )}
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ background: "oklch(from var(--qa-accent) l c h / 8%)", border: "1px solid oklch(from var(--qa-accent) l c h / 25%)" }}>
        <p className="text-xs" style={{ color: "var(--qa-fg3)" }}>
          <strong style={{ color: "var(--qa-fg2)" }}>Gmail-hez app-password kell</strong> (NEM a sima jelszó!). 2FA-val védett fiókhoz: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: "var(--qa-accent)" }} className="underline">myaccount.google.com/apppasswords</a>.
        </p>
      </div>
    </div>
  );
}
