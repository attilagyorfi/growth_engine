/**
 * ProjectsPage – Super Admin workspace management
 * Lists all projects owned by the super_admin, allows create/edit/delete/setActive
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Globe, Building2, Pencil, Trash2,
  CheckCircle, Circle, Loader2, X, Save, ExternalLink, LayoutDashboard,
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
  { label: "Kék", value: "oklch(0.6 0.2 255)" },
  { label: "Lila", value: "oklch(0.55 0.22 280)" },
  { label: "Zöld", value: "oklch(0.65 0.18 165)" },
  { label: "Sárga", value: "oklch(0.75 0.18 75)" },
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
  color: "oklch(0.6 0.2 255)",
  logoUrl: "",
};

export default function ProjectsPage() {
  const [, navigate] = useLocation();
  const [editingProject, setEditingProject] = useState<ProjectFormData | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<ProjectFormData>({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: projects = [], isLoading } = trpc.projects.list.useQuery(undefined, {
    staleTime: 15_000,
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
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
              Projektek
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
              Minden projekt egy izolált workspace – saját stratégiával, tartalommal és leadekkel.
            </p>
          </div>
          <Button
            onClick={() => { setShowNewForm(true); setEditingProject(null); }}
            className="flex items-center gap-2"
            style={{ background: "oklch(0.6 0.2 255)", color: "white" }}
          >
            <Plus size={15} />
            Új projekt
          </Button>
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
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.6 0.2 255)" }} />
          </div>
        ) : projects.length === 0 && !showNewForm ? (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 8%)" }}
          >
            <FolderOpen size={40} className="mx-auto mb-3 opacity-30" style={{ color: "oklch(0.6 0.2 255)" }} />
            <p className="text-sm font-medium" style={{ color: "oklch(0.55 0.015 240)" }}>
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
                      color: p.color ?? "oklch(0.6 0.2 255)",
                      logoUrl: p.logoUrl ?? "",
                    })}
                    onSetActive={() => setActiveMutation.mutate({ projectId: p.id })}
                    onDelete={() => setDeleteConfirmId(p.id)}
                    onOpen={() => navigate(`/projektek/${p.id}`)}
                    isSettingActive={setActiveMutation.isPending}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent style={{ background: "oklch(0.16 0.022 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "oklch(0.92 0.008 240)" }}>Projekt törlése</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "oklch(0.55 0.015 240)" }}>
              Biztosan törölni szeretnéd ezt a projektet? Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.78 0.008 240)", border: "none" }}>
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
  };
  onEdit: () => void;
  onSetActive: () => void;
  onDelete: () => void;
  onOpen: () => void;
  isSettingActive: boolean;
}

function ProjectCard({ project, onEdit, onSetActive, onDelete, onOpen, isSettingActive }: ProjectCardProps) {
  const accentColor = project.color ?? "oklch(0.6 0.2 255)";

  return (
    <div
      className="rounded-2xl border p-5 flex items-start gap-4 transition-all hover:border-white/15"
      style={{
        background: "oklch(0.16 0.022 255)",
        borderColor: project.isActive ? `${accentColor}` : "oklch(1 0 0 / 8%)",
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
          <span className="font-semibold text-base" style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}>
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
              style={{ color: "oklch(0.6 0.2 255)" }}
            >
              <Globe size={11} />
              {project.website.replace(/^https?:\/\//, "")}
              <ExternalLink size={10} />
            </a>
          )}
          {project.industry && (
            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.55 0.015 240)" }}>
              <Building2 size={11} />
              {project.industry}
            </span>
          )}
        </div>
        {project.description && (
          <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "oklch(0.5 0.015 240)" }}>
            {project.description}
          </p>
        )}
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
            style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.6 0.015 240)" }}
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
          style={{ color: "oklch(0.55 0.015 240)" }}
          title="Szerkesztés"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
          style={{ color: "oklch(0.55 0.015 240)" }}
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
      style={{ background: "oklch(0.18 0.025 255)", borderColor: "oklch(0.6 0.2 255 / 30%)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "oklch(0.88 0.008 240)" }}>
          {isNew ? "Új projekt" : "Projekt szerkesztése"}
        </h3>
        <button type="button" onClick={onCancel} className="p-1 rounded-lg hover:bg-white/8" style={{ color: "oklch(0.55 0.015 240)" }}>
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>
            Projekt neve *
          </label>
          <Input
            value={form.name}
            onChange={e => update({ name: e.target.value })}
            placeholder="pl. G2A Marketing"
            className="bg-white/5 border-white/10 text-sm"
            style={{ color: "oklch(0.88 0.008 240)" }}
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>
            Weboldal
          </label>
          <Input
            value={form.website}
            onChange={e => update({ website: e.target.value })}
            placeholder="https://pelda.hu"
            className="bg-white/5 border-white/10 text-sm"
            style={{ color: "oklch(0.88 0.008 240)" }}
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>
            Iparág
          </label>
          <Select value={form.industry} onValueChange={v => update({ industry: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-sm" style={{ color: "oklch(0.78 0.008 240)" }}>
              <SelectValue placeholder="Válassz iparágat" />
            </SelectTrigger>
            <SelectContent style={{ background: "oklch(0.18 0.025 255)", borderColor: "oklch(1 0 0 / 12%)" }}>
              {INDUSTRIES.map(ind => (
                <SelectItem key={ind} value={ind} style={{ color: "oklch(0.78 0.008 240)" }}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>
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
          <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>
            Logó URL (opcionális)
          </label>
          <Input
            value={form.logoUrl}
            onChange={e => update({ logoUrl: e.target.value })}
            placeholder="https://..."
            className="bg-white/5 border-white/10 text-sm"
            style={{ color: "oklch(0.88 0.008 240)" }}
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: "oklch(0.65 0.015 240)" }}>
            Leírás (opcionális)
          </label>
          <textarea
            value={form.description}
            onChange={e => update({ description: e.target.value })}
            placeholder="Rövid leírás a projektről..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none border"
            style={{
              background: "oklch(0.14 0.02 255)",
              borderColor: "oklch(1 0 0 / 10%)",
              color: "oklch(0.88 0.008 240)",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel} size="sm" style={{ color: "oklch(0.55 0.015 240)" }}>
          Mégsem
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || !form.name.trim()}
          size="sm"
          className="flex items-center gap-1.5"
          style={{ background: "oklch(0.6 0.2 255)", color: "white" }}
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Mentés
        </Button>
      </div>
    </div>
  );
}
