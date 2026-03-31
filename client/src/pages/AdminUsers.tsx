import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, Search, MoreHorizontal, KeyRound, UserCheck, UserX,
  Shield, Clock, Loader2, CheckCircle2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAppAuth } from "@/hooks/useAppAuth";
import { useLocation } from "wouter";

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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!user || user.role !== "super_admin") {
    navigate("/iranyitopult");
    return null;
  }

  const filtered = (users ?? []).filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
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

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Keresés név vagy email alapján..."
          className="pl-9 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/30"
        />
      </div>

      {/* Users table */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-3 border-b border-white/[0.06]">
          <CardTitle className="text-sm font-medium text-white/60 uppercase tracking-wider">
            Felhasználók ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-white/30">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nincs találat</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 font-semibold text-sm shrink-0">
                    {(u.name ?? u.email)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{u.name ?? "—"}</span>
                      {u.role === "super_admin" && (
                        <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-xs py-0">Admin</Badge>
                      )}
                      {!u.active && (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs py-0">Inaktív</Badge>
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate">{u.email}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-xs text-white/30">
                    {u.onboardingCompleted ? (
                      <span className="flex items-center gap-1 text-green-400/70">
                        <CheckCircle2 className="w-3 h-3" /> Onboarding kész
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Onboarding folyamatban
                      </span>
                    )}
                  </div>
                  <div className="hidden md:block text-xs text-white/30">
                    {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString("hu-HU") : "Még nem lépett be"}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white/30 hover:text-white h-8 w-8 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 text-white">
                      <DropdownMenuItem
                        onClick={() => setEditUser({ id: u.id, name: u.name, active: u.active })}
                        className="hover:bg-white/5 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 mr-2" /> Szerkesztés
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setResetUser({ id: u.id, email: u.email }); setResetSuccess(false); }}
                        className="hover:bg-white/5 cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 mr-2" /> Jelszó visszaállítása
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateUser.mutate({ userId: u.id, active: !u.active })}
                        className="hover:bg-white/5 cursor-pointer text-orange-400"
                      >
                        {u.active ? <UserX className="w-4 h-4 mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                        {u.active ? "Letiltás" : "Aktiválás"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
  );
}
