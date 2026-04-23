/**
 * Breadcrumb – aloldalakhoz navigációs morzsaút
 * CODEX.md 9.2 alapján
 */
import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-4" style={{ color: "oklch(0.5 0.015 240)" }}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight size={12} style={{ color: "oklch(0.4 0.015 240)" }} />}
          {item.href ? (
            <Link
              href={item.href}
              className="transition-colors hover:underline"
              style={{ color: "oklch(0.55 0.015 240)" }}
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium" style={{ color: "oklch(0.85 0.008 240)" }}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
