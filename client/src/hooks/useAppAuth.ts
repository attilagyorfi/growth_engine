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
  subscriptionPlan: string | null;
};

export function useAppAuth() {
  const utils = trpc.useUtils();
  // staleTime: 0 ensures the onboardingCompleted flag is always fresh from the server
  // This prevents the guard from using stale cached data after login/logout
  const { data: user, isLoading: loading, refetch } = trpc.appAuth.me.useQuery(undefined, { staleTime: 0 });
  const [, navigate] = useLocation();

  const logoutMutation = trpc.appAuth.logout.useMutation({
    onSuccess: async () => {
      // Invalidate auth cache so guards re-evaluate immediately after logout
      await utils.appAuth.me.invalidate();
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
