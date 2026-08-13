/*
 * G2A Growth Engine – DetailModal (v2 — shadcn Dialog fölött)
 *
 * Az audit-agent talált: "Kettős modal pattern — DetailModal + ManusDialog +
 * shadcn Dialog egymás mellett. Egyet választani."
 *
 * A ManusDialog (dead code) törölve. A DetailModal API-ja VÁLTOZATLAN (a
 * ProfilePage 5 helyen használja), de a belső implementáció most a shadcn
 * `<Dialog>` — így focus-trap, ESC-kezelés, aria-attribútumok és a
 * theme-token stílus ingyen jön, nem kézzel újraírva.
 *
 * Így egyetlen modal-alapréteg van a projektben: a shadcn Dialog. Ez a
 * DetailModal egy vékony, kényelmi wrapper fölötte (title/subtitle/footer
 * slot-okkal), a többi oldal (Campaigns, AdminUsers, ProjectsPage) pedig
 * közvetlenül a shadcn Dialog-ot használja.
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function DetailModal({ isOpen, onClose, title, subtitle, children, footer }: DetailModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-5 border-b flex-shrink-0 space-y-0.5 text-left" style={{ borderColor: "var(--qa-border)" }}>
          <DialogTitle style={{ fontFamily: "Sora, sans-serif", color: "var(--qa-fg)" }}>
            {title}
          </DialogTitle>
          {subtitle && (
            <DialogDescription style={{ color: "var(--qa-fg3)" }}>
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--qa-border)" }}>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
