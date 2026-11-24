/**
 * Kötelező és tiltott kifejezések, záradék, és a márkaprofil szinkronja a Social Hubba (G2).
 * Profilonként külön példány kell (key={profileId}), hogy a félkész szöveg ne kerülhessen át.
 */
import { useState } from "react";
import { toast } from "sonner";
import { draftToRules, rulesToDraft, type BrandRulesDraft } from "@/lib/brandForm";
import { trpc } from "@/lib/trpc";

const inputStyle = { background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg)" };
const buttonClass = "px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40";

const FIELDS: { key: keyof BrandRulesDraft; label: string; hint: string; rows: number }[] = [
  { key: "required", label: "Kötelező kifejezések (soronként egy)", hint: "Mindegyiknek minden posztban szerepelnie kell.", rows: 4 },
  { key: "forbidden", label: "Tiltott kifejezések (soronként egy)", hint: "Egyik posztban sem lehetnek benne.", rows: 4 },
  { key: "disclaimer", label: "Kötelező záradék", hint: "Szó szerint szerepelnie kell minden posztban.", rows: 3 },
];

const STATE_TEXT = {
  not_paired: "Ez az ügyfél még nincs párosítva a Social Hubbal. A szabályokat már most megadhatod.",
  not_configured: "A Social Hub még nincs bekötve. A szabályokat már most megadhatod.",
  connection_error: "A Social Hub-kapcsolat most nem olvasható. Szólj a rendszergazdának.",
} as const;

const formatTime = (value: string | Date) => new Date(value).toLocaleString("hu-HU", { dateStyle: "medium", timeStyle: "short" });

export default function BrandRulesSync({ profileId, cardBg, border }: { profileId: string; cardBg: string; border: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.socialHub.brandRules.get.useQuery({ profileId });
  // null: nincs félkész szerkesztés, a mentett érték látszik. A háttérfrissítés ezt nem írja felül.
  const [draft, setDraft] = useState<BrandRulesDraft | null>(null);
  const refresh = () => utils.socialHub.brandRules.get.invalidate({ profileId });
  const save = trpc.socialHub.brandRules.save.useMutation({ onError: (e) => toast.error(e.message), onSettled: refresh });
  const sync = trpc.socialHub.brandRules.sync.useMutation({
    onSuccess: (r) => { if (r.ok) toast.success(r.message); else toast.error(r.message); },
    onError: (e) => toast.error(e.message),
    onSettled: refresh,
  });

  if (isLoading) return null;
  const cardStyle = { background: cardBg, borderColor: border };
  if (!data || data.state === "unavailable") {
    return (
      <div className="rounded-xl border p-5" style={cardStyle}>
        <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Poszt-szabályok</h3>
        <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)" }}>Ez a rész most nem érhető el. Próbáld meg később.</p>
      </div>
    );
  }

  const shown = draft ?? rulesToDraft(data.rules);
  const handleSave = () => {
    const submitted = shown;
    save.mutate({ profileId, ...draftToRules(submitted) }, {
      onSuccess: (rules) => {
        utils.socialHub.brandRules.get.setData({ profileId }, (old) => (old ? { ...old, rules } : old));
        // Ha mentés közben tovább írtál, az megmarad.
        setDraft((current) => (current === submitted ? null : current));
        toast.success("Szabályok mentve");
      },
    });
  };

  return (
    <div className="rounded-xl border p-5 space-y-4" style={cardStyle}>
      <div>
        <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Poszt-szabályok</h3>
        <p className="text-xs mt-1" style={{ color: "var(--qa-fg4)" }}>
          A Social Hub ezek alapján megállítja a posztot. Csak azt írd ide, ami tényleg kötelező vagy tilos.
        </p>
      </div>

      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`brand-${f.key}`} className="text-xs font-semibold mb-1 block" style={{ color: "var(--qa-fg3)" }}>{f.label}</label>
          <textarea id={`brand-${f.key}`} rows={f.rows} value={shown[f.key]} onChange={(e) => setDraft({ ...shown, [f.key]: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm border resize-y" style={inputStyle} />
          <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg4)" }}>{f.hint}</p>
        </div>
      ))}

      <button type="button" disabled={save.isPending || draft === null} onClick={handleSave} className={buttonClass}
        style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)" }}>
        {save.isPending ? "Mentés…" : "Szabályok mentése"}
      </button>

      <div className="pt-4 border-t space-y-2 text-xs" style={{ borderColor: border, color: "var(--qa-fg4)" }}>
        <h4 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Szinkron a Social Hubba</h4>
        {data.state !== "ok" ? <p>{STATE_TEXT[data.state]}</p> : (
          <>
            <p>A hangnem, az aktív pillérek és a szabályok mentés után maguktól átmennek.</p>
            <p>{data.lastSyncedAt ? `Utolsó sikeres szinkron: ${formatTime(data.lastSyncedAt)}` : "Még nem volt sikeres szinkron."}</p>
            {data.lastError && (
              <p style={{ color: "var(--qa-danger)" }}>{data.lastError.message} ({formatTime(data.lastError.at)})</p>
            )}
            {data.pending && <p style={{ color: "var(--qa-warning)" }}>Van még el nem küldött változás.</p>}
            {data.running && <p>Épp fut egy szinkron, vagy az előző eredményére várunk. Ez legfeljebb másfél perc.</p>}
            {draft !== null && <p>A nem mentett szöveg nem megy át. Előbb mentsd el.</p>}
            <button type="button" disabled={sync.isPending} onClick={() => sync.mutate({ profileId })} className={buttonClass}
              style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>
              {sync.isPending ? "Szinkronizálás…" : "Szinkronizálás most"}
            </button>
          </>
        )}
        {data.warnings.length > 0 && (
          <ul className="list-disc pl-4" style={{ color: "var(--qa-warning)" }}>
            {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        <p>Az alárkákra nem vonatkozik, mert nincs saját márkaprofiljuk.</p>
      </div>
    </div>
  );
}
