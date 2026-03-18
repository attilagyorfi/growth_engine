/*
 * G2A Growth Engine – DetailModal
 * Reusable slide-in modal for displaying details and confirming actions
 */

import { X } from "lucide-react";
import { useEffect } from "react";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function DetailModal({ isOpen, onClose, title, subtitle, children, footer }: DetailModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "oklch(0 0 0 / 60%)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl"
        style={{
          background: "oklch(0.18 0.022 255)",
          border: "1px solid oklch(1 0 0 / 12%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: "oklch(1 0 0 / 8%)" }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ fontFamily: "Sora, sans-serif", color: "oklch(0.92 0.008 240)" }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.015 240)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ml-4"
            style={{ background: "oklch(0.22 0.02 255)", color: "oklch(0.6 0.015 240)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: "oklch(1 0 0 / 8%)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
