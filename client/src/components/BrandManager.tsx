/**
 * Márkák (alárkák) kezelése a Beállításokban (G1): hozzáadás, átnevezés,
 * Social Hub-azonosító és törlés. Az ügyfél egy profil marad, a márkák ezen belüli
 * címkék; a Riportoknál márkára szűkített riport készíthető.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Brand = { id: string; name: string; socialHubExternalRef: string | null };

const inputStyle = { background: "var(--qa-surface2)", borderColor: "var(--qa-border)", color: "var(--qa-fg)" };
const primaryStyle = { background: "var(--qa-accent)", color: "var(--qa-accent-on)" };

function BrandRow({ profileId, brand, onChanged }: { profileId: string; brand: Brand; onChanged: () => void }) {
  const [name, setName] = useState(brand.name);
  const [ref, setRef] = useState(brand.socialHubExternalRef ?? "");
  useEffect(() => { setName(brand.name); setRef(brand.socialHubExternalRef ?? ""); }, [brand.name, brand.socialHubExternalRef]);
  const update = trpc.brands.update.useMutation({
    onSuccess: () => { onChanged(); toast.success("Márka mentve"); },
    onError: (err) => toast.error(err.message),
  });
  const remove = trpc.brands.delete.useMutation({
    onSuccess: () => { onChanged(); toast.success("Márka törölve"); },
    onError: (err) => toast.error(err.message),
  });
  return (
    <form className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); update.mutate({ profileId, brandId: brand.id, name, socialHubExternalRef: ref }); }}>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Márka neve"
        className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[160px]" style={inputStyle} />
      <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={64} placeholder="Social Hub-azonosító (nem kötelező)"
        aria-label="A márka Social Hub-azonosítója"
        className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[180px]" style={inputStyle} />
      <button type="submit" disabled={update.isPending}
        className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={primaryStyle}>
        {update.isPending ? "Mentés…" : "Mentés"}
      </button>
      <button type="button" disabled={remove.isPending}
        onClick={() => { if (confirm(`Biztosan törlöd a(z) „${brand.name}” márkát? A márka metrikái is törlődnek, a kész riportok megmaradnak.`)) remove.mutate({ profileId, brandId: brand.id }); }}
        className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
        style={{ background: "var(--qa-surface2)", color: "var(--qa-danger)" }}>
        Törlés
      </button>
    </form>
  );
}

export default function BrandManager({ profileId, cardBg, border }: { profileId: string; cardBg: string; border: string }) {
  const utils = trpc.useUtils();
  const { data: brands = [] } = trpc.brands.list.useQuery({ profileId }, { enabled: !!profileId });
  const [name, setName] = useState("");
  const [ref, setRef] = useState("");
  const refresh = () => utils.brands.list.invalidate({ profileId });
  const create = trpc.brands.create.useMutation({
    onSuccess: () => { setName(""); setRef(""); refresh(); toast.success("Márka hozzáadva"); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="rounded-xl border p-5" style={{ background: cardBg, borderColor: border }}>
      <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Márkák</h3>
      <p className="text-xs mt-0.5 mb-3" style={{ color: "var(--qa-fg4)" }}>
        Ha az ügyfélnek több márkája van (pl. klinika és termék), itt veheted fel őket. A Riportoknál márkánként is készíthetsz riportot. Ha a márka a Social Hubban külön ügyfél, add meg az azonosítóját is.
      </p>
      <div className="space-y-2 mb-3">
        {brands.length === 0 && (
          <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>Még nincs márka. Márka nélkül minden riport az egész ügyfélről szól.</p>
        )}
        {brands.map((b) => <BrandRow key={b.id} profileId={profileId} brand={b} onChanged={refresh} />)}
      </div>
      <form className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); create.mutate({ profileId, name, socialHubExternalRef: ref }); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Új márka neve"
          aria-label="Új márka neve" className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[160px]" style={inputStyle} />
        <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={64} placeholder="Social Hub-azonosító (nem kötelező)"
          aria-label="Új márka Social Hub-azonosítója" className="px-3 py-2 rounded-lg text-sm border flex-1 min-w-[180px]" style={inputStyle} />
        <button type="submit" disabled={create.isPending || !name.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={primaryStyle}>
          {create.isPending ? "Hozzáadás…" : "Hozzáadás"}
        </button>
      </form>
    </div>
  );
}
