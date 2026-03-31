/**
 * G2A Growth Engine – useAppAuth hook
 * Saját email+jelszó alapú autentikáció React hook
 */
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: "super_admin" | "user";
  onboardingCompleted: boolean;
  profileId: string | null;
};

export function useAppAuth() {
  const { data: user, isLoading: loading, refetch } = trpc.appAuth.me.useQuery();
  const [, navigate] = useLocation();

  const logoutMutation = trpc.appAuth.logout.useMutation({
    onSuccess: () => {
      navigate("/bejelentkezes");
    },
  });

  const logout = () => logoutMutation.mutate();

  return {
    user: user ?? null,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === "super_admin",
    logout,
    refetch,
  };
}
