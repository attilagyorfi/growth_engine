/*
 * G2A Growth Engine – TeamSection (Beállítások → Csapat)
 *
 * A profile csapat-meghívóinak kezelése: meghívó küldése (email + szerep),
 * függőben lévő meghívók listája, visszavonás. A meghívott ELFOGADÁSA
 * (regisztráció + profile-hoz kötés) egy későbbi PR — ezért a "Tag" fogalom
 * itt még nem jelenik meg, csak a meghívók.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DetailModal from "@/components/DetailModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Plus, Mail, Loader2, X, Clock, ShieldCheck, Crown, Eye, Pencil } from "lucide-react";

type TeamRole = "owner" | "editor" | "viewer";

const ROLE_META: Record<TeamRole, { label: string; desc: string; icon: React.ReactNode; badgeClass: string }> = {
  owner: {
    label: "Tulajdonos",
    desc: "Teljes hozzáférés — kezelheti a csapatot és a beállításokat.",
    icon: <Crown size={13} />,
    badgeClass: "bg-yellow-500/15 text-yellow-500",
  },
  editor: {
    label: "Szerkesztő",
    desc: "Tartalmat és kampányokat hozhat létre, szerkeszthet.",
    icon: <Pencil size={13} />,
    badgeClass: "bg-primary/15 text-primary",
  },
  viewer: {
    label: "Megtekintő",
    desc: "Csak megtekintheti a tartalmat, nem szerkeszthet.",
    icon: <Eye size={13} />,
    badgeClass: "bg-cyan-500/15 text-cyan-500",
  },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: "Függőben", className: "bg-yellow-500/15 text-yellow-500" },
  accepted: { label: "Elfogadva", className: "bg-green-500/15 text-green-500" },
  revoked: { label: "Visszavonva", className: "bg-red-500/12 text-red-400" },
  expired: { label: "Lejárt", className: "bg-white/10 text-[var(--qa-fg4)]" },
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
}

interface TeamSectionProps {
  profileId: string;
}

export default function TeamSection({ profileId }: TeamSectionProps) {
  const utils = trpc.useUtils();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("editor");
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: invites = [], isLoading } = trpc.team.list.useQuery(
    { profileId },
    { enabled: !!profileId },
  );

  const inviteMutation = trpc.team.invite.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.emailSent
          ? `Meghívó elküldve: ${res.email}`
          : `Meghívó létrehozva: ${res.email} (email küldés jelenleg nem elérhető)`,
      );
      setInviteOpen(false);
      setEmail("");
      setRole("editor");
      utils.team.list.invalidate({ profileId });
    },
    onError: (err) => toast.error(err.message || "A meghívó küldése nem sikerült"),
  });

  const revokeMutation = trpc.team.revoke.useMutation({
    onSuccess: () => {
      toast.success("Meghívó visszavonva");
      setRevokeId(null);
      utils.team.list.invalidate({ profileId });
    },
    onError: (err) => toast.error(err.message || "A visszavonás nem sikerült"),
  });

  const pending = invites.filter(i => i.status === "pending");
  const past = invites.filter(i => i.status !== "pending");

  const handleInvite = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Add meg a meghívandó email címét");
      return;
    }
    inviteMutation.mutate({ profileId, email: trimmed, role });
  };

  return (
    <div className="space-y-4">
      {/* Fejléc + meghívó gomb */}
      <div className="rounded-xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--qa-fg2)" }}>Csapattagok</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--qa-fg4)" }}>
              Hívj meg munkatársakat ehhez a profilhoz, szerep szerinti jogosultsággal.
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
            style={{ background: "oklch(from var(--qa-accent) l c h / 15%)", color: "var(--qa-accent)" }}
          >
            <Plus size={12} /> Meghívó
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--qa-fg4)" }} />
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-10">
            <Users size={32} className="mx-auto mb-3" style={{ color: "var(--qa-fg4)" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--qa-fg3)" }}>Nincs függőben lévő meghívó</p>
            <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>Hívj meg csapattagokat az együttműködéshez</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--qa-fg4)" }}>
              Függőben lévő meghívók ({pending.length})
            </p>
            {pending.map(inv => {
              const roleMeta = ROLE_META[inv.role as TeamRole] ?? ROLE_META.editor;
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={{ background: "var(--qa-surface2, oklch(from var(--qa-surface) calc(l + 0.02) c h))", borderColor: "var(--qa-border)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "oklch(from var(--qa-accent) l c h / 12%)" }}
                  >
                    <Mail size={15} style={{ color: "var(--qa-accent)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--qa-fg2)" }}>{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${roleMeta.badgeClass}`}>
                        {roleMeta.icon} {roleMeta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--qa-fg4)" }}>
                        <Clock size={10} /> Lejár: {formatDate(inv.expiresAt)}
                      </span>
                      {inv.invitedByName && (
                        <span className="text-[10px]" style={{ color: "var(--qa-fg4)" }}>
                          · {inv.invitedByName} hívta meg
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setRevokeId(inv.id)}
                    className="p-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-red-500/10"
                    title="Meghívó visszavonása"
                    style={{ color: "var(--qa-fg4)" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Korábbi meghívók (elfogadott / visszavont / lejárt) — halványan */}
      {past.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--qa-fg4)" }}>
            Korábbi meghívók ({past.length})
          </p>
          <div className="space-y-1.5">
            {past.map(inv => {
              const roleMeta = ROLE_META[inv.role as TeamRole] ?? ROLE_META.editor;
              const statusMeta = STATUS_META[inv.status] ?? STATUS_META.expired;
              return (
                <div key={inv.id} className="flex items-center gap-3 py-1.5 px-1" style={{ opacity: 0.7 }}>
                  <Mail size={13} className="flex-shrink-0" style={{ color: "var(--qa-fg4)" }} />
                  <span className="text-xs truncate flex-1" style={{ color: "var(--qa-fg3)" }}>{inv.email}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${roleMeta.badgeClass}`}>{roleMeta.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meghívó modal */}
      <DetailModal
        isOpen={inviteOpen}
        onClose={() => { if (!inviteMutation.isPending) setInviteOpen(false); }}
        title="Csapattag meghívása"
        subtitle="A meghívott emailben kap egy linket a csatlakozáshoz."
        footer={
          <>
            <button
              onClick={() => setInviteOpen(false)}
              disabled={inviteMutation.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--qa-surface2, oklch(from var(--qa-surface) calc(l + 0.03) c h))", color: "var(--qa-fg3)" }}
            >
              Mégse
            </button>
            <button
              onClick={handleInvite}
              disabled={inviteMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--qa-accent)" }}
            >
              {inviteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Meghívó küldése
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--qa-fg3)" }}>
              Email cím
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              placeholder="munkatars@ceg.hu"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
              style={{ background: "var(--qa-bg)", borderColor: "var(--qa-border)", color: "var(--qa-fg2)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--qa-fg3)" }}>
              Szerep
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_META) as TeamRole[]).map(r => (
                  <SelectItem key={r} value={r}>
                    <span className="flex items-center gap-2">
                      {ROLE_META[r].icon} {ROLE_META[r].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] mt-1.5 flex items-center gap-1.5" style={{ color: "var(--qa-fg4)" }}>
              <ShieldCheck size={11} /> {ROLE_META[role].desc}
            </p>
          </div>
        </div>
      </DetailModal>

      {/* Visszavonás megerősítés */}
      <AlertDialog open={!!revokeId} onOpenChange={(open) => { if (!open) setRevokeId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Meghívó visszavonása</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan visszavonod ezt a meghívót? A meghívó-link ezután érvénytelen lesz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (revokeId) revokeMutation.mutate({ id: revokeId }); }}
              disabled={revokeMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {revokeMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              Visszavonás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
