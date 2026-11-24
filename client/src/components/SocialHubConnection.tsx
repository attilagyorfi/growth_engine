/** Social Hub-kapcsolat a Beállításokban (G2). Csak rendszergazdának; a kulcs soha nem jön vissza. */
import { useState } from "react";
import { toast } from "sonner";
import SocialHubWebhook from "@/components/SocialHubWebhook";
import { trpc } from "@/lib/trpc";

const inputStyle = { background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg)" };
const buttonClass = "px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40";

const SOURCE_TEXT = {
  stored: "Be van kötve.",
  env: "A szerver beállításában megadott kapcsolat él.",
  none: "Még nincs bekötve.",
  error: "A mentett kapcsolat nem olvasható. Add meg újra.",
} as const;

export default function SocialHubConnection({ cardBg, border }: { cardBg: string; border: string }) {
  const utils = trpc.useUtils();
  const { data } = trpc.socialHub.connection.get.useQuery();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  // A bontás és a címcsere a webhook-titkot is törli.
  const refresh = () => { utils.socialHub.connection.get.invalidate(); utils.socialHub.webhook.get.invalidate(); };
  const onError = (err: { message: string }) => toast.error(err.message);
  const save = trpc.socialHub.connection.save.useMutation({
    onSuccess: () => { setBaseUrl(""); setApiKey(""); refresh(); toast.success("Kapcsolat mentve"); }, onError,
  });
  const check = trpc.socialHub.connection.check.useMutation({
    onSuccess: (r) => { if (r.ok) toast.success(`Működik, ${r.clients.length} ügyfelet látunk.`); else toast.error(r.message); }, onError,
  });
  const disconnect = trpc.socialHub.connection.disconnect.useMutation({
    onSuccess: () => { check.reset(); refresh(); toast.success("Kapcsolat bontva"); }, onError,
  });
  if (!data?.available) return null;

  return (
    <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Social Hub</h3>
      <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--qa-fg4)" }}>
        {SOURCE_TEXT[data.source]}
        {data.baseUrl && ` ${data.baseUrl}`}
        {data.keyLast4 && ` (kulcs vége: …${data.keyLast4})`}
      </p>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate({ baseUrl, apiKey }); }}>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} maxLength={500} placeholder="https://…/api/v1" aria-label="API-cím"
          className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[200px]" style={inputStyle} />
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" autoComplete="off" placeholder="API-kulcs" aria-label="API-kulcs"
          className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[200px]" style={inputStyle} />
        <button type="submit" disabled={save.isPending || !baseUrl.trim() || !apiKey.trim()} className={buttonClass}
          style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)" }}>
          {save.isPending ? "Mentés…" : "Mentés"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" disabled={check.isPending || data.source === "none"} onClick={() => check.mutate()} className={buttonClass}
          style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>
          {check.isPending ? "Ellenőrzés…" : "Kapcsolat ellenőrzése"}
        </button>
        {data.baseUrl && (
          <button type="button" disabled={disconnect.isPending} className={buttonClass} style={{ background: "var(--qa-surface2)", color: "var(--qa-danger)" }}
            onClick={() => { if (confirm("Biztosan bontod a Social Hub-kapcsolatot?")) disconnect.mutate(); }}>
            Bontás
          </button>
        )}
      </div>
      {check.data?.ok && (
        <ul className="text-xs mt-3 space-y-0.5" style={{ color: "var(--qa-fg4)" }}>
          {check.data.clients.map((c, i) => <li key={i}>{c.name}: {c.externalRef ?? "nincs azonosítója"}</li>)}
        </ul>
      )}
      {data.source !== "none" && <SocialHubWebhook border={border} />}
    </div>
  );
}
