/**
 * G2A Growth Engine – CommandPalette (⌘K / Ctrl+K)
 *
 * A saasui.design audit talált: 9 menü + super_admin projektváltó → egy
 * parancspalettával 3x gyorsabb a navigáció. A shadcn `<Command>` már
 * telepítve (cmdk lib), csak wire-elni kell.
 *
 * Használat (DashboardLayout-ba beemelve):
 *   const [open, setOpen] = useState(false);
 *   useHotkey("mod+k", () => setOpen(v => !v));
 *   <CommandPalette open={open} onOpenChange={setOpen} />
 *
 * Csoportok:
 *   - Navigáció: minden sidebar-item (plan-alapú szűréssel)
 *   - Gyors műveletek: Új projekt (super_admin), Kijelentkezés, Profil
 *   - Projektek (super_admin): projekt-váltó, minden meglévő projektnek 1 tétel
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Brain, BarChart3, Layers, Megaphone, TrendingUp,
  SearchCheck, Video, Mail, Settings, FolderOpen, LogOut, User,
  Plus, ArrowRightLeft, Sparkles,
} from "lucide-react";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const { isSuperAdmin, logout } = useAppAuth();
  const subscription = useSubscription();
  const { projects, activeProject, setActiveProject } = useActiveProject();

  // Auto-close a paletta minden runAction után
  const run = (action: () => void) => {
    onOpenChange(false);
    // Késleltetve: hagyni kell a dialog-ot bezárulni, aztán navigáljunk
    setTimeout(action, 50);
  };

  // ESC-re bezár (a CommandDialog már natívan kezeli, redundáns de biztos)
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onOpenChange]);

  // Nav item lista — plan-alapú szűréssel (megegyezik a DashboardLayout-tal).
  type NavItem = { label: string; icon: React.ReactNode; href: string; visible: boolean };
  const navItems: NavItem[] = [
    { label: "Irányítópult", icon: <LayoutDashboard size={16} />, href: "/iranyitopult", visible: true },
    { label: "Intelligencia", icon: <Brain size={16} />, href: "/intelligencia", visible: true },
    { label: "Stratégia", icon: <BarChart3 size={16} />, href: "/strategia", visible: isSuperAdmin || subscription.canUseStrategy },
    { label: "Tartalom Studio", icon: <Layers size={16} />, href: "/tartalom-studio", visible: true },
    { label: "Kampányok", icon: <Megaphone size={16} />, href: "/kampanyok", visible: isSuperAdmin || subscription.canUseCampaigns },
    { label: "Analitika", icon: <TrendingUp size={16} />, href: "/analitika", visible: true },
    { label: "SEO Audit", icon: <SearchCheck size={16} />, href: "/seo", visible: true },
    { label: "Beállítások", icon: <Settings size={16} />, href: "/beallitasok", visible: true },
    // Admin
    { label: "Hírlevél", icon: <Mail size={16} />, href: "/hirlevel", visible: isSuperAdmin },
    { label: "Projektek", icon: <FolderOpen size={16} />, href: "/projektek", visible: isSuperAdmin },
    { label: "Felhasználók", icon: <User size={16} />, href: "/admin/felhasznalok", visible: isSuperAdmin },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Parancspaletta"
      description="Keress egy oldalt vagy műveletet — használd az ↑↓ nyilakat és az Entert."
    >
      <CommandInput placeholder="Keresés oldalak, műveletek, projektek között…" />
      <CommandList>
        <CommandEmpty>Nincs találat.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigáció">
          {navItems.filter(i => i.visible).map(item => (
            <CommandItem
              key={item.href}
              value={`nav ${item.label}`}
              onSelect={() => run(() => navigate(item.href))}
            >
              {item.icon}
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Projektváltó (super_admin only) */}
        {isSuperAdmin && projects.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projektváltás">
              {projects.map(p => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name}`}
                  onSelect={() => run(() => {
                    setActiveProject(p.id);
                    toast.success(`Aktív projekt: ${p.name}`);
                  })}
                  disabled={activeProject?.id === p.id}
                >
                  <ArrowRightLeft size={16} />
                  <span>{p.name}</span>
                  {activeProject?.id === p.id && (
                    <span className="ml-auto text-xs" style={{ color: "var(--qa-fg4)" }}>Aktív</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Gyors műveletek */}
        <CommandSeparator />
        <CommandGroup heading="Gyors műveletek">
          {isSuperAdmin && (
            <CommandItem
              value="action new-project uj projekt"
              onSelect={() => run(() => navigate("/projektek"))}
            >
              <Plus size={16} />
              <span>Új projekt</span>
              <CommandShortcut>Projektek → +</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem
            value="action ai writer ai iro"
            onSelect={() => run(() => navigate("/ai-iro"))}
          >
            <Sparkles size={16} />
            <span>AI író</span>
          </CommandItem>
          <CommandItem
            value="action video studio videokeszito"
            onSelect={() => run(() => navigate("/video-studio"))}
          >
            <Video size={16} />
            <span>Videókészítő</span>
            <CommandShortcut>Hamarosan</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="action profile profil"
            onSelect={() => run(() => navigate("/profil"))}
          >
            <User size={16} />
            <span>Saját profil</span>
          </CommandItem>
          <CommandItem
            value="action logout kijelentkezes"
            onSelect={() => run(() => logout())}
          >
            <LogOut size={16} />
            <span>Kijelentkezés</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
