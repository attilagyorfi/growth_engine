/**
 * NewsletterSection – super_admin hírlevél-küldő panel
 *
 * Két blokk:
 *   1) Feliratkozók listája (regisztráció-kor `newsletterConsent: true`-val
 *      mentett címek). Stats + táblázat.
 *   2) Új kampány szerkesztő: tárgy + HTML body + Küldés gomb confirm modallal.
 *      A küldés a server/routers/newsletter.ts:sendCampaign endpoint-on át megy.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Send, Loader2, Users, AlertTriangle, Sparkles, X } from "lucide-react";

const cardBg = "var(--qa-surface)";
const border = "var(--qa-border)";

export default function NewsletterSection() {
  const { data: subs, isLoading } = trpc.newsletter.listSubscribers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sendMutation = trpc.newsletter.sendCampaign.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ Kampány elküldve — ${data.sent}/${data.total} sikeres, ${data.failed} hiba.`, { duration: 6000 });
      setConfirmOpen(false);
      setSubject("");
      setHtmlBody("");
    },
    onError: (err) => {
      toast.error(err.message ?? "Hiba a hírlevél küldése során.");
      setConfirmOpen(false);
    },
  });

  const subscriberCount = subs?.length ?? 0;
  const canSend = subject.trim().length > 0 && htmlBody.trim().length >= 10 && subscriberCount > 0;

  return (
    <div className="space-y-4">
      {/* Feliratkozók */}
      <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: "var(--qa-accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Hírlevél feliratkozók</h3>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "oklch(0.6 0.2 255 / 15%)", color: "oklch(0.75 0.2 255)" }}
          >
            {isLoading ? "…" : subscriberCount} fő
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
          Azok a felhasználók, akik a regisztráció során bejelölték a hírlevél feliratkozást.
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--qa-accent)" }} />
          </div>
        ) : subscriberCount === 0 ? (
          <div className="text-center py-8" style={{ color: "var(--qa-fg4)" }}>
            <Mail size={24} className="mx-auto mb-2 opacity-60" />
            <p className="text-sm">Még nincs feliratkozó.</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--qa-surface2)" }}>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--qa-fg3)" }}>Név</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--qa-fg3)" }}>Email</th>
                    <th className="text-left px-3 py-2 font-semibold" style={{ color: "var(--qa-fg3)" }}>Regisztrált</th>
                  </tr>
                </thead>
                <tbody>
                  {subs!.map((s) => (
                    <tr key={s.email} className="border-t" style={{ borderColor: border }}>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg2)" }}>{s.contact || "—"}</td>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg2)" }}>{s.email}</td>
                      <td className="px-3 py-2" style={{ color: "var(--qa-fg4)" }}>
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("hu-HU") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Kampány szerkesztő */}
      <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} style={{ color: "var(--qa-accent-purple)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Új hírlevél küldése</h3>
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--qa-fg4)" }}>
          A küldés azonnal, az összes feliratkozónak. A láblécet (név, leiratkozás link, brand) automatikusan hozzáadjuk.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>Tárgy</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Pl. Júniusi marketing tippek – 3 növekedési taktika"
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ background: "var(--qa-surface2)", borderColor: border, color: "var(--qa-fg2)" }}
            />
            <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)" }}>{subject.length}/200 karakter</p>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>
              Tartalom (HTML támogatva — pl. &lt;h2&gt;, &lt;p&gt;, &lt;a&gt;, &lt;strong&gt;)
            </label>
            <textarea
              value={htmlBody}
              onChange={e => setHtmlBody(e.target.value)}
              placeholder={"<h2>Köszöntelek!</h2>\n<p>Ebben a hónapban három olyan B2B taktikát mutatok be...</p>"}
              rows={10}
              className="w-full px-3 py-2 rounded-lg text-sm border font-mono"
              style={{ background: "var(--qa-surface2)", borderColor: border, color: "var(--qa-fg2)" }}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend || sendMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--qa-accent)" }}
          >
            <Send size={14} />
            Küldés most ({subscriberCount} címzett)
          </button>
          {!canSend && subscriberCount > 0 && (
            <span className="text-xs" style={{ color: "var(--qa-fg4)" }}>
              Tölts ki tárgyat és legalább 10 karakter tartalmat.
            </span>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.7)" }}
          onClick={() => !sendMutation.isPending && setConfirmOpen(false)}
        >
          <div
            className="rounded-xl border p-6 max-w-md w-full"
            style={{ background: cardBg, borderColor: border }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(from var(--qa-warning) l c h / 15%)" }}>
                <AlertTriangle size={18} style={{ color: "var(--qa-warning)" }} />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold mb-1" style={{ color: "var(--qa-fg)" }}>Biztos elküldöd?</h4>
                <p className="text-sm" style={{ color: "var(--qa-fg3)" }}>
                  Ez az email <strong style={{ color: "var(--qa-fg2)" }}>{subscriberCount} feliratkozónak</strong> megy ki azonnal. A küldés <strong>nem visszavonható</strong>.
                </p>
              </div>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={sendMutation.isPending}
                style={{ color: "var(--qa-fg4)" }}
                className="hover:opacity-70"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-lg p-3 mb-4" style={{ background: "var(--qa-surface2)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--qa-fg4)" }}>TÁRGY</p>
              <p className="text-sm" style={{ color: "var(--qa-fg2)" }}>{subject}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={sendMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}
              >
                Mégse
              </button>
              <button
                onClick={() => sendMutation.mutate({ subject, htmlBody })}
                disabled={sendMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--qa-accent)" }}
              >
                {sendMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sendMutation.isPending ? "Küldés..." : "Igen, küldés"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
