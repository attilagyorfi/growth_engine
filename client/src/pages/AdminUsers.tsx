import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, MoreHorizontal, KeyRound, UserCheck, UserX,
  Shield, Clock, Loader2, CheckCircle2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useLocation } from "wouter";
import { DataTable } from "@/components/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminUsers() {
  const { user, loading } = useAppAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<{ id: string; name: string | null; active: boolean } | null>(null);
  const [resetUser, setResetUser] = useState<{ id: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [editError, setEditError] = useState("");

  const { data: users, refetch } = trpc.appAuth.adminListUsers.useQuery(undefined, {
    enabled: !!user && user.role === "super_admin",
  });

  const updateUser = trpc.appAuth.adminUpdateUser.useMutation({
    onSuccess: () => { refetch(); setEditUser(null); setEditError(""); },
    onError: (err) => setEditError(err.message),
  });

  const resetPassword = trpc.appAuth.adminResetPassword.useMutation({
    onSuccess: () => { setResetSuccess(true); setNewPassword(""); },
    onError: (err) => setEditError(err.message),
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || user.role !== "super_admin") {
    navigate("/iranyitopult");
    return null;
  }

  // Az AdminUsers a régi manuális `search`-t nem használja mar — a DataTable
  // sajat global filter-t ad. A search state megmarad backward-compat okokbol
  // (ha valahol a linter reference-eli), de a lista renderelese most a
  // DataTable-en at megy.

  type AdminUser = NonNullable<typeof users>[number];

  const columns: ColumnDef<AdminUser>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Felhasználó",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "var(--qa-accent-soft)", color: "var(--qa-accent)" }}>
              {(u.name ?? u.email)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate" style={{ color: "var(--qa-fg)" }}>{u.name ?? "—"}</span>
                {u.role === "super_admin" && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                    <Shield className="w-2.5 h-2.5 mr-0.5" /> Admin
                  </Badge>
                )}
                {!u.active && (
                  <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Inaktív</Badge>
                )}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--qa-fg4)" }}>{u.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "onboardingCompleted",
      header: "Onboarding",
      cell: ({ row }) => row.original.onboardingCompleted
        ? (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--qa-success)" }}>
            <CheckCircle2 className="w-3 h-3" /> Kész
          </span>
        )
        : (
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--qa-fg4)" }}>
            <Clock className="w-3 h-3" /> Folyamatban
          </span>
        ),
    },
    {
      accessorKey: "lastSignedIn",
      header: "Utolsó belépés",
      cell: ({ row }) => (
        <span className="text-xs" style={{ color: "var(--qa-fg3)" }}>
          {row.original.lastSignedIn
            ? new Date(row.original.lastSignedIn).toLocaleDateString("hu-HU")
            : "Még nem lépett be"}
        </span>
      ),
      // Sort: null-ok az elejére a "még nem lépett be" csoport
      sortingFn: (a, b) => {
        const ta = a.original.lastSignedIn ? new Date(a.original.lastSignedIn).getTime() : 0;
        const tb = b.original.lastSignedIn ? new Date(b.original.lastSignedIn).getTime() : 0;
        return ta - tb;
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setEditUser({ id: u.id, name: u.name, active: u.active })}
                className="cursor-pointer"
              >
                <UserCheck className="w-4 h-4 mr-2" /> Szerkesztés
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setResetUser({ id: u.id, email: u.email }); setResetSuccess(false); }}
                className="cursor-pointer"
              >
                <KeyRound className="w-4 h-4 mr-2" /> Jelszó visszaállítása
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateUser.mutate({ userId: u.id, active: !u.active })}
                className="cursor-pointer"
                style={{ color: "var(--qa-warning)" }}
              >
                {u.active ? <UserX className="w-4 h-4 mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                {u.active ? "Letiltás" : "Aktiválás"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [updateUser]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Felhasználók kezelése</h1>
          <p className="text-white/40 text-sm">Regisztrált ügyfelek és adminok</p>
        </div>
        <Badge className="ml-auto bg-violet-500/10 text-violet-300 border-violet-500/20">
          <Shield className="w-3 h-3 mr-1" /> Super Admin
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Összes felhasználó", val: users?.length ?? 0, icon: Users },
          { label: "Aktív", val: users?.filter(u => u.active).length ?? 0, icon: UserCheck },
          { label: "Onboarding kész", val: users?.filter(u => u.onboardingCompleted).length ?? 0, icon: CheckCircle2 },
          { label: "Admin", val: users?.filter(u => u.role === "super_admin").length ?? 0, icon: Shield },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className="w-5 h-5 text-violet-400 shrink-0" />
              <div>
                <div className="text-xl font-bold text-white">{stat.val}</div>
                <div className="text-xs text-white/40">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table — TanStack DataTable pilot (sort + filter + paginate) */}
      <DataTable
        columns={columns}
        data={users ?? []}
        searchPlaceholder="Keresés név vagy email alapján…"
        searchableColumns={["name", "email"]}
        pageSize={15}
        emptyMessage="Nincs felhasználó."
      />

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="bg-[#12121e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Felhasználó szerkesztése</DialogTitle>
          </DialogHeader>
          {editError && (
            <Alert className="bg-red-500/10 border-red-500/20 text-red-400">
              <AlertDescription>{editError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Név</Label>
              <Input
                value={editUser?.name ?? ""}
                onChange={(e) => setEditUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="bg-white/[0.05] border-white/[0.08] text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-sm">Aktív fiók</Label>
              <Switch
                checked={editUser?.active ?? true}
                onCheckedChange={(val) => setEditUser(prev => prev ? { ...prev, active: val } : null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)} className="text-white/50">Mégse</Button>
            <Button
              onClick={() => editUser && updateUser.mutate({ userId: editUser.id, name: editUser.name ?? undefined, active: editUser.active })}
              disabled={updateUser.isPending}
              className="bg-violet-600 hover:bg-violet-500 text-white border-0"
            >
              {updateUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mentés"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={() => { setResetUser(null); setResetSuccess(false); }}>
        <DialogContent className="bg-[#12121e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Jelszó visszaállítása</DialogTitle>
          </DialogHeader>
          {resetSuccess ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-white/70">A jelszó sikeresen megváltozott.</p>
            </div>
          ) : (
            <>
              <p className="text-white/50 text-sm">{resetUser?.email}</p>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Új jelszó (min. 8 karakter)</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Új jelszó"
                  minLength={8}
                  className="bg-white/[0.05] border-white/[0.08] text-white"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setResetUser(null)} className="text-white/50">Mégse</Button>
                <Button
                  onClick={() => resetUser && resetPassword.mutate({ userId: resetUser.id, newPassword })}
                  disabled={resetPassword.isPending || newPassword.length < 8}
                  className="bg-violet-600 hover:bg-violet-500 text-white border-0"
                >
                  {resetPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Visszaállítás"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}
