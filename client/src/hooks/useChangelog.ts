/**
 * useChangelog — az "Újdonságok" drawer állapot-hook-ja.
 *
 * A user-menu-ben egy "Újdonságok • N" gomb — a `hasUnread` alapján badge.
 * A LocalStorage-ban tároljuk az UTOLSÓ MEGNYITÁS DÁTUM-SZTRINGJÉT (a
 * legfelső CHANGELOG entry ISO date-je). Ha van olyan entry, aminek a
 * dátuma nagyobb mint az utolsó megnyitás, van "új".
 *
 * Miért dátum-alapú (nem entry-id-alapú)?
 * - Egyszerűbb: 1 érték a localStorage-ban
 * - Robusztus: ha új entry-t adunk a fájlhoz retroaktív dátummal
 *   (pl. régebbi bug-fix dokumentálása), NEM triggerel badge-et
 * - Elég pontos: dátum-mp precizítás nem kell
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHANGELOG } from "@/lib/changelog";

const STORAGE_KEY = "g2a_changelog_last_seen";

export function useChangelog() {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(STORAGE_KEY) ?? "";
  });

  // A legfrissebb entry dátuma — ehhez viszonyítjuk a lastSeen-t
  const latestDate = useMemo(() => {
    return CHANGELOG.reduce((max, e) => (e.date > max ? e.date : max), "");
  }, []);

  const unreadCount = useMemo(() => {
    if (!lastSeen) {
      // Ha még soha nem nyitotta meg, MINDENT új-nak számít, DE
      // sokat mutatnánk. Cap: max 3 (a legfrissebb 3 új).
      return Math.min(3, CHANGELOG.length);
    }
    return CHANGELOG.filter((e) => e.date > lastSeen).length;
  }, [lastSeen]);

  const hasUnread = unreadCount > 0;

  const markSeen = useCallback(() => {
    setLastSeen(latestDate);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, latestDate);
    }
  }, [latestDate]);

  // Amikor a drawer bezárul, markSeen — így a badge eltűnik miután
  // a user tényleg megnézte az újdonságokat.
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) markSeen();
    },
    [markSeen],
  );

  return { open, setOpen: handleOpenChange, hasUnread, unreadCount, markSeen };
}
