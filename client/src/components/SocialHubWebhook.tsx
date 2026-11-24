/** Visszajelzés a Social Hubból: webhook-cím és titok (G2). Csak rendszergazdának; a titok soha nem jön vissza. */
import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const inputStyle = { background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg)" };
const buttonClass = "px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40";

export default function SocialHubWebhook({ border }: { border: string }) {
  const utils = trpc.useUtils();
  const { data } = trpc.socialHub.webhook.get.useQuery();
  const [secret, setSecret] = useState("");
  const refresh = () => utils.socialHub.webhook.get.invalidate();
  const onError = (err: { message: string }) => toast.error(err.message);
  const save = trpc.socialHub.webhook.saveSecret.useMutation({
    onSuccess: () => { setSecret(""); refresh(); toast.success("Titok mentve"); }, onError,
  });
  const remove = trpc.socialHub.webhook.deleteSecret.useMutation({
    onSuccess: () => { refresh(); toast.success("Titok törölve"); }, onError,
  });
  if (!data?.available) return null;

  const copy = () => navigator.clipboard.writeText(data.url)
    .then(() => toast.success("Cím másolva"))
    .catch(() => toast.error("Nem sikerült másolni. Jelöld ki kézzel."));

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: border }}>
      <h4 className="text-sm font-semibold" style={{ color: "var(--qa-fg2)" }}>Visszajelzés a Social Hubból</h4>
      <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--qa-fg4)" }}>
        Ezt a címet add meg a Social Hubban: Beállítások → Webhookok.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <code className="text-xs px-2 py-1.5 rounded border break-all" style={inputStyle}>{data.url}</code>
        <button type="button" onClick={copy} aria-label="Cím másolása" className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
          style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)" }}>
          <Copy size={12} /> Másolás
        </button>
      </div>
      <p className="text-xs mb-2" style={{ color: "var(--qa-fg4)" }}>
        {data.secretSet
          ? `A titok be van állítva${data.updatedAt ? ` (${new Date(data.updatedAt).toLocaleString("hu-HU")})` : ""}.`
          : "A titok nincs beállítva."}
        {" "}Ha bontod a kapcsolatot vagy másik API-címet adsz meg, a titkot újra meg kell adnod.
      </p>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate({ secret }); }}>
        <input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" autoComplete="off" maxLength={512}
          placeholder="whsec_…" aria-label="Webhook-titok"
          className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[200px]" style={inputStyle} />
        <button type="submit" disabled={save.isPending || !secret.trim()} className={buttonClass}
          style={{ background: "var(--qa-accent)", color: "var(--qa-accent-on)" }}>
          {save.isPending ? "Mentés…" : data.secretSet ? "Csere" : "Mentés"}
        </button>
        {data.secretSet && (
          <button type="button" disabled={remove.isPending} className={buttonClass} style={{ background: "var(--qa-surface2)", color: "var(--qa-danger)" }}
            onClick={() => { if (confirm("Biztosan törlöd a titkot? Utána nem érkezik visszajelzés.")) remove.mutate(); }}>
            Törlés
          </button>
        )}
      </form>
    </div>
  );
}
