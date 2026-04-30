/**
 * ProjectsPage – Super Admin workspace management
 * Lists all projects owned by the super_admin, allows create/edit/delete/setActive
 */

import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Globe, Building2, Pencil, Trash2,
  CheckCircle, Circle, Loader2, X, Save, ExternalLink, LayoutDashboard,
  Sparkles, TrendingUp, Calendar, Users, Archive, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INDUSTRIES = [
  "Technológia / SaaS", "E-kereskedelem", "Pénzügyi szolgáltatások",
  "Egészségügy", "Oktatás", "Ingatlan", "Jogi szolgáltatások",
  "Marketing / Reklám", "Gyártás / Ipar", "Vendéglátás / Turizmus",
  "Szépségipar / Wellness", "Nonprofit", "Egyéb",
];

const PROJECT_COLORS = [
  { label: "Kék", value: "var(--qa-accent)" },
  { label: "Lila", value: "var(--qa-accent)" },
  { label: "Zöld", value: "var(--qa-success)" },
  { label: "Sárga", value: "var(--qa-warning)" },
  { label: "Piros", value: "oklch(0.6 0.22 30)" },
  { label: "Narancs", value: "oklch(0.7 0.2 50)" },
  { label: "Cián", value: "oklch(0.65 0.15 200)" },
];

interface ProjectFormData {
  id?: string;
  name: string;
  website: string;
  industry: string;
  description: string;
  color: string;
  logoUrl: string;
}

const emptyForm: ProjectFormData = {
  name: "",
  website: "",
  industry: "",
  description: "",
  color: "var(--qa-accent)",
  logoUrl: "",
};

export default function ProjectsPage() {
  const [, navigate] = useLocation();
  const [editingProject, setEditingProject] = useState<ProjectFormData | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<ProjectFormData>({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const utils = trpc.useUtils();

  const { data: projects = [], isLoading } = trpc.projects.list.useQuery(undefined, {
    staleTime: 15_000,
  });

  const { data: archivedProjects = [] } = trpc.projects.listArchived.useQuery(undefined, {
    staleTime: 30_000,
  });

  const upsertMutation = trpc.projects.upsert.useMutation({
    onSuccess: () => {
      toast.success("Projekt mentve!");
      utils.projects.list.invalidate();
      setEditingProject(null);
      setShowNewForm(false);
      setNewForm({ ...emptyForm });
    },
    onError: (e) => toast.error(e.message),
  });

  const setActiveMutation = trpc.projects.setActive.useMutation({
    onSuccess: () => {
      toast.success("Aktív projekt beállítva!");
      utils.projects.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Projekt törölve.");
      utils.projects.list.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveMutation = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Projekt archiválva.");
      utils.projects.list.invalidate();
      utils.projects.listArchived.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const restoreMutation = trpc.projects.restore.useMutation({
    onSuccess: () => {
      toast.success("Projekt visszahelyezve.");
      utils.projects.list.invalidate();
      utils.projects.listArchived.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = (form: ProjectFormData) => {
    if (!form.name.trim()) { toast.error("A projekt neve kötelező!"); return; }
    upsertMutation.mutate({
      id: form.id,
      name: form.name.trim(),
      website: form.website.trim() || undefined,
      industry: form.industry || undefined,
      description: form.description.trim() || undefined,
      color: form.color || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
    });
  };

  return (
    <DashboardLayout title="Projektek" subtitle="Workspace-ek kezelése">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
              Projektek
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--qa-fg3)" }}>
              Minden projekt egy izolált workspace – saját stratégiával, tartalommal és leadekkel.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{
                background: showArchived ? "oklch(0.55 0.015 240 / 20%)" : "var(--qa-surface2)",
                color: showArchived ? "var(--qa-fg2)" : "var(--qa-fg3)",
              }}
            >
              <Archive size={13} />
              Archivált ({archivedProjects.length})
            </button>
            <Button
              onClick={() => { setShowNewForm(true); setEditingProject(null); }}
              className="flex items-center gap-2"
              style={{ background: "var(--qa-accent)", color: "white" }}
            >
              <Plus size={15} />
              Új projekt
            </Button>
          </div>
        </div>

        {/* New project form */}
        {showNewForm && (
          <ProjectForm
            form={newForm}
            setForm={setNewForm}
            onSave={() => handleSave(newForm)}
            onCancel={() => { setShowNewForm(false); setNewForm({ ...emptyForm }); }}
            isSaving={upsertMutation.isPending}
            isNew
          />
        )}

        {/* Project list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--qa-accent)" }} />
          </div>
        ) : projects.length === 0 && !showNewForm ? (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border)" }}
          >
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" style={{ color: "var(--qa-accent)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--qa-fg3)" }}>
              Még nincs projekt. Hozd létre az elsőt!
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div key={p.id}>
                {editingProject?.id === p.id ? (
                  <ProjectForm
                    form={editingProject}
                    setForm={setEditingProject as (f: ProjectFormData) => void}
                    onSave={() => handleSave(editingProject)}
                    onCancel={() => setEditingProject(null)}
                    isSaving={upsertMutation.isPending}
                  />
                ) : (
                  <ProjectCard
                    project={p}
                    onEdit={() => setEditingProject({
                      id: p.id,
                      name: p.name,
                      website: p.website ?? "",
                      industry: p.industry ?? "",
                      description: p.description ?? "",
                      color: p.color ?? "var(--qa-accent)",
                      logoUrl: p.logoUrl ?? "",
                    })}
                    onSetActive={() => setActiveMutation.mutate({ projectId: p.id })}
                    onDelete={() => setDeleteConfirmId(p.id)}
                    onOpen={() => navigate(`/projektek/${p.id}`)}
                    onArchive={() => archiveMutation.mutate({ id: p.id })}
                    isSettingActive={setActiveMutation.isPending}
                  />
                )}
              </div>
            ))}
            {/* Archived projects section */}
            {showArchived && archivedProjects.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-4 mb-2">
                  <div className="h-px flex-1" style={{ background: "var(--qa-border)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--qa-fg4)" }}>Archivált projektek</span>
                  <div className="h-px flex-1" style={{ background: "var(--qa-border)" }} />
                </div>
                {archivedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border p-4 flex items-center gap-4 opacity-60"
                    style={{ background: "oklch(0.14 0.018 255)", borderColor: "var(--qa-border)" }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                      style={{ background: p.color ?? "oklch(0.4 0.01 240)" }}
                    >
                      {p.name[0]?.toUpperCase() ?? "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "oklch(0.65 0.008 240)" }}>{p.name}</p>
                      {p.industry && <p className="text-xs" style={{ color: "var(--qa-fg4)" }}>{p.industry}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreMutation.mutate({ id: p.id })}
                      disabled={restoreMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ background: "oklch(0.55 0.18 145 / 15%)", color: "oklch(0.65 0.18 145)" }}
                    >
                      <RotateCcw size={11} />
                      Visszahelyezés
                    </button>
                  </div>
                ))}
              </>
            )}
            {showArchived && archivedProjects.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: "var(--qa-fg4)" }}>Nincs archivált projekt.</p>
            )}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border-hi)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "var(--qa-fg)" }}>Projekt törlése</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--qa-fg3)" }}>
              Biztosan törölni szeretnéd ezt a projektet? Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: "var(--qa-surface2)", color: "var(--qa-fg2)", border: "none" }}>
              Mégsem
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
              style={{ background: "oklch(0.6 0.22 30)", color: "white" }}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Törlés"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    website?: string | null;
    industry?: string | null;
    description?: string | null;
    color?: string | null;
    isActive?: boolean | null;
    createdAt?: Date | null;
    profileId?: string | null;
  };
  onEdit: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onArchive?: () => void;
  isSettingActive: boolean;
}

function ProgressBadge({ done, icon, label, count }: { done: boolean; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        background: done ? "oklch(0.55 0.18 145 / 15%)" : "oklch(0.55 0.015 240 / 10%)",
        color: done ? "oklch(0.7 0.18 145)" : "var(--qa-fg4)",
      }}
    >
      {icon}
      {label}{count !== undefined && count > 0 ? ` (${count})` : ""}
    </span>
  );
}

function ProjectCard({ project, onEdit, onSetActive, onDelete, onOpen, onArchive, isSettingActive }: ProjectCardProps) {
  const accentColor = project.color ?? "var(--qa-accent)";
  const { data: progress } = trpc.projects.getProgress.useQuery(
    { projectId: project.id },
    { staleTime: 60_000 }
  );

  return (
    <div
      className="rounded-2xl border p-5 flex items-start gap-4 transition-all hover:border-white/15"
      style={{
        background: "var(--qa-surface)",
        borderColor: project.isActive ? `${accentColor}` : "var(--qa-border)",
        boxShadow: project.isActive ? `0 0 0 1px ${accentColor}` : "none",
      }}
    >
      {/* Color dot / logo */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
        style={{ background: `${accentColor}`, boxShadow: `0 0 16px ${accentColor}40` }}
      >
        {project.name[0]?.toUpperCase() ?? "P"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-base" style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
            {project.name}
          </span>
          {project.isActive && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: `${accentColor}20`, color: accentColor }}
            >
              Aktív
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {project.website && (
            <a
              href={project.website.startsWith("http") ? project.website : `https://${project.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: "var(--qa-accent)" }}
            >
              <Globe size={11} />
              {project.website.replace(/^https?:\/\//, "")}
              <ExternalLink size={10} />
            </a>
          )}
          {project.industry && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--qa-fg3)" }}>
              <Building2 size={11} />
              {project.industry}
            </span>
          )}
        </div>
        {project.description && (
          <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "var(--qa-fg4)" }}>
            {project.description}
          </p>
        )}
        {/* Progress badges */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <ProgressBadge
            done={!!progress?.onboarding.done}
            icon={<Sparkles size={10} />}
            label="Onboarding"
          />
          <ProgressBadge
            done={!!progress?.strategy.done}
            icon={<TrendingUp size={10} />}
            label="Stratégia"
            count={progress?.strategy.count}
          />
          <ProgressBadge
            done={!!progress?.content.done}
            icon={<Calendar size={10} />}
            label="Naptár"
            count={progress?.content.count}
          />
          <ProgressBadge
            done={!!progress?.leads.done}
            icon={<Users size={10} />}
            label="Leadek"
            count={progress?.leads.count}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ background: `${accentColor}20`, color: accentColor }}
          title="Projekt megnyitása"
        >
          <LayoutDashboard size={12} />
          Megnyitás
        </button>
        {!project.isActive && (
          <button
            type="button"
            onClick={onSetActive}
            disabled={isSettingActive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--qa-surface2)", color: "var(--qa-fg3)" }}
          >
            {isSettingActive ? <Loader2 size={12} className="animate-spin" /> : <Circle size={12} />}
            Aktívává tesz
          </button>
        )}
        {project.isActive && (
          <span className="flex items-center gap-1 text-xs" style={{ color: accentColor }}>
            <CheckCircle size={13} />
            Aktív
          </span>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg transition-all hover:bg-white/8"
          style={{ color: "var(--qa-fg3)" }}
          title="Szerkesztés"
        >
          <Pencil size={14} />
        </button>
        {onArchive && (
          <button
            type="button"
            onClick={onArchive}
            className="p-1.5 rounded-lg transition-all hover:bg-yellow-500/10"
            style={{ color: "var(--qa-fg3)" }}
            title="Archiválás"
          >
            <Archive size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
          style={{ color: "var(--qa-fg3)" }}
          title="Törlés"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── ProjectForm ──────────────────────────────────────────────────────────────

interface ProjectFormProps {
  form: ProjectFormData;
  setForm: (f: ProjectFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
}

function ProjectForm({ form, setForm, onSave, onCancel, isSaving, isNew }: ProjectFormProps) {
  const update = (partial: Partial<ProjectFormData>) => setForm({ ...form, ...partial });

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ background: "var(--qa-surface)", borderColor: "oklch(from var(--qa-accent) l c h / 30%)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--qa-fg2)" }}>
          {isNew ? "Új projekt" : "Projekt szerkesztése"}
        </h3>
        <button type="button" onClick={onCancel} className="p-1 rounded-lg hover:bg-white/8" style={{ color: "var(--qa-fg3)" }}>
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--qa-fg3)" }}>
            Projekt neve *
          </label>
          <Input
            value={form.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="pl. G2A Marketing"
            className="bg-white/5 border-white/10 text-sm"
            style={{ color: "var(--qa-fg2)" }}
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--qa-fg3)" }}>
            Weboldal
          </label>
          <Input
            value={form.website}
            onChange={e => update({ website: e.target.value })}
            placeholder="https://pelda.hu"
            className="bg-white/5 border-white/10 text-sm"
            style={{ color: "var(--qa-fg2)" }}
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--qa-fg3)" }}>
            Iparág
          </label>
          <Select value={form.industry} onValueChange={v => update({ industry: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-sm" style={{ color: "var(--qa-fg2)" }}>
              <SelectValue placeholder="Válassz iparágat" />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--qa-surface)", borderColor: "var(--qa-border-hi)" }}>
              {INDUSTRIES.map(ind => (
                <SelectItem key={ind} value={ind} style={{ color: "var(--qa-fg2)" }}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--qa-fg3)" }}>
            Szín
          </label>
          <div className="flex gap-2 flex-wrap">
            {PROJECT_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => update({ color: c.value })}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{
                  background: c.value,
                  borderColor: form.color === c.value ? "white" : "transparent",
                  boxShadow: form.color === c.value ? `0 0 8px ${c.value}` : "none",
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {/* Logo URL */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--qa-fg3)" }}>
            Logó URL (opcionális)
          </label>
          <Input
            value={form.logoUrl}
            onChange={e => update({ logoUrl: e.target.value })}
            placeholder="https://..."
            className="bg-white/5 border-white/10 text-sm"
            style={{ color: "var(--qa-fg2)" }}
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--qa-fg3)" }}>
            Leírás (opcionális)
          </label>
          <textarea
            value={form.description}
            onChange={e => update({ description: e.target.value })}
            placeholder="Rövid leírás a projektről..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none border"
            style={{
              background: "var(--qa-bg)",
              borderColor: "var(--qa-border)",
              color: "var(--qa-fg2)",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} size="sm" style={{ color: "var(--qa-fg3)" }}>
          Mégsem
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || !form.name.trim()}
          size="sm"
          className="flex items-center gap-1.5"
          style={{ background: "var(--qa-accent)", color: "white" }}
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Mentés
        </Button>
      </div>
    </div>
  );
}
