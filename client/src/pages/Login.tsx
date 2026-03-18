/**
 * G2A Growth Engine – Login Page
 * Uses Manus OAuth for authentication
 */

import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Loader2, Zap } from "lucide-react";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.13 0.02 255)" }}>
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.13 0.02 255)" }}>
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "linear-gradient(oklch(0.6 0.2 255) 1px, transparent 1px), linear-gradient(90deg, oklch(0.6 0.2 255) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}>
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
            G2A Growth Engine
          </h1>
          <p className="text-gray-400 text-sm">Marketing AI Operating System</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl p-8 border" style={{ background: "oklch(0.17 0.02 255)", borderColor: "oklch(0.28 0.03 255)" }}>
          <h2 className="text-xl font-semibold text-white mb-2 text-center">Bejelentkezés</h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Jelentkezz be a vezérlőpult eléréséhez
          </p>

          <button
            onClick={handleLogin}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, oklch(0.6 0.2 255), oklch(0.55 0.18 165))" }}
          >
            <Zap size={18} />
            Bejelentkezés Manus fiókkal
          </button>

          <p className="text-gray-500 text-xs text-center mt-4">
            Csak jogosult felhasználók férhetnek hozzá a rendszerhez.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          G2A Marketing · Growth Engine v2.0
        </p>
      </div>
    </div>
  );
}
