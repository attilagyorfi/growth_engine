/**
 * „Küldés a Social Hubba” megerősítő ablak (G2): mennyi poszt megy, melyik ügyfélhez, mi marad
 * ki és miért; utána posztonként az eredmény. Minden vázlat marad, itt semmi nem ütemez.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

export type SendSelection = { postId: string } | { month: string };
type Result = { postId: string; outcome: string; message: string };

const selectClass = "w-full px-3 py-2 rounded-lg text-sm border mt-1";
const selectStyle = { background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg)" };
const buttonClass = "px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40";
const primary = { background: "var(--qa-accent)", color: "var(--qa-accent-on)" };
const muted = { color: "var(--qa-fg4)" };

export default function SocialHubSendDialog({ profileId, selection, onClose }: { profileId: string; selection: SendSelection; onClose: () => void }) {
  const [targetId, setTargetId] = useState<string>();
  const [accountChoices, setAccountChoices] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const preview = trpc.socialHub.previewSend.useQuery(
    { profileId, selection, targetId, accountChoices },
    { retry: false, refetchOnWindowFocus: false, staleTime: 0, gcTime: 0, placeholderData: (prev) => prev },
  );
  const done = (r: { results: Result[] }) => {
    setResults((old) => [...old.filter((o) => !r.results.some((n) => n.postId === o.postId)), ...r.results]);
    setConfirmed([]);
    preview.refetch();
  };
  const onError = () => { preview.refetch(); };
  const send = trpc.socialHub.send.useMutation({ onSuccess: done, onError });
  const repeat = trpc.socialHub.repeat.useMutation({ onSuccess: done, onError });

  const data = preview.data;
  const items = data?.items ?? [];
  const needsConfirm = items.filter((i) => i.state === "changed" || i.state === "uncertain_expired");
  const toSend = items.filter((i) => i.state === "ready" || (needsConfirm.includes(i) && confirmed.includes(i.postId)));
  const skipped = items.filter((i) => i.state !== "ready" && !needsConfirm.includes(i));
  const repeatable = Array.from(new Set(items.flatMap((i) => (i.state === "uncertain" && i.attemptId ? [i.attemptId] : []))));
  const busy = preview.isFetching || send.isPending || repeat.isPending;
  const error = send.error ?? repeat.error ?? preview.error;
  const titleOf = (id: string) => items.find((i) => i.postId === id)?.title ?? "Poszt";
  const count = (key: "imageDropped" | "pillarShortened" | "alsoScheduled") => toSend.filter((i) => i[key]).length;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !send.isPending) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Küldés a Social Hubba</DialogTitle>
          <DialogDescription>A posztok vázlatként mennek át. Jóváhagyni és időzíteni a Social Hubban tudod őket.</DialogDescription>
        </DialogHeader>
        {preview.isLoading && <p className="text-sm" style={muted}>Egy pillanat…</p>}
        {error && <p className="text-sm" style={{ color: "var(--qa-danger)" }}>{error.message}</p>}
        {data && (
          <div className="space-y-3 text-sm">
            {data.targets.length > 1 && (
              <label className="block">Melyik ügyfélhez menjen?
                <select className={selectClass} style={selectStyle} value={targetId ?? ""}
                  onChange={(e) => { setTargetId(e.target.value || undefined); setAccountChoices({}); setConfirmed([]); }}>
                  <option value="">Válassz…</option>
                  {data.targets.map((t) => <option key={t.id} value={t.id}>{t.name} → {t.clientName}</option>)}
                </select>
              </label>
            )}
            {data.accountOptions.map((o) => (
              <label key={o.platform} className="block">Melyik {o.platform}-fiókra?
                <select className={selectClass} style={selectStyle} value={accountChoices[o.platform] ?? ""}
                  onChange={(e) => setAccountChoices(({ [o.platform]: _old, ...rest }) => (e.target.value ? { ...rest, [o.platform]: e.target.value } : rest))}>
                  <option value="">Válassz…</option>
                  {o.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            ))}
            <p><strong>{toSend.length} poszt megy</strong>{data.target && <> ide: <strong>{data.target.clientName}</strong></>}</p>
            {count("alsoScheduled") > 0 && <p style={{ color: "var(--qa-warning)" }}>{count("alsoScheduled")} posztot a Growth Engine is közzétesz, ezért kétszer jelenhet meg.</p>}
            {count("imageDropped") > 0 && <p style={muted}>{count("imageDropped")} poszt kép nélkül megy.</p>}
            {count("pillarShortened") > 0 && <p style={muted}>{count("pillarShortened")} posztnál rövidítjük a pillér nevét.</p>}
            {needsConfirm.map((i) => (
              <label key={i.postId} className="flex gap-2 items-start">
                <input type="checkbox" className="mt-1" checked={confirmed.includes(i.postId)}
                  onChange={(e) => setConfirmed((c) => (e.target.checked ? [...c, i.postId] : c.filter((x) => x !== i.postId)))} />
                <span><strong>{i.title}</strong>: {i.reason}</span>
              </label>
            ))}
            {skipped.length > 0 && (
              <div>
                <p className="font-semibold">Kimarad ({skipped.length})</p>
                <ul className="space-y-0.5" style={muted}>{skipped.map((i) => <li key={i.postId}>{i.title}: {i.reason}</li>)}</ul>
              </div>
            )}
            {items.length === 0 && <p style={muted}>Ebben a hónapban nincs időponttal rendelkező poszt.</p>}
          </div>
        )}
        {results.length > 0 && (
          <div className="text-sm">
            <p className="font-semibold">Eredmény</p>
            <ul className="space-y-0.5">{results.map((r) => <li key={r.postId}>{titleOf(r.postId)}: {r.message}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-end">
          {repeatable.map((attemptId, i) => (
            <button key={attemptId} disabled={busy} className={buttonClass} style={selectStyle} onClick={() => repeat.mutate({ profileId, attemptId })}>
              Ismétlés{repeatable.length > 1 ? ` (${i + 1}.)` : ""}
            </button>
          ))}
          <button disabled={send.isPending} className={buttonClass} style={selectStyle} onClick={onClose}>Bezárás</button>
          <button disabled={busy || !data?.target || toSend.length === 0} className={buttonClass} style={primary}
            onClick={() => {
              if (!data?.target) return;
              const ids = (state: string) => toSend.filter((i) => i.state === state).map((i) => i.postId);
              send.mutate({
                profileId, postIds: toSend.map((i) => i.postId), targetId: data.target.id, expectedClientId: data.target.clientId,
                accountChoices, confirmResendIds: ids("changed"), confirmUncertainIds: ids("uncertain_expired"),
              });
            }}>
            {send.isPending ? "Küldés…" : results.some((r) => r.outcome === "not_started") ? "Folytatás" : "Küldés a Social Hubba"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
