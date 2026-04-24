/**
 * useTour – Shepherd.js interaktív bemutató hook
 * Új felhasználóknak automatikusan elindul az első bejelentkezéskor.
 * Kézzel is újraindítható a Beállítások oldalról.
 */

import { useEffect, useRef, useCallback } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – shepherd.js ships a CJS bundle without proper TS declarations
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";

const TOUR_DONE_KEY = "g2a_tour_done";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSteps(tour: any): any[] {
  const btn = (label: string, action: () => void, secondary = false) => ({
    text: label,
    action,
    secondary,
    classes: secondary
      ? "shepherd-btn-secondary"
      : "shepherd-btn-primary",
  });

  return [
    {
      id: "welcome",
      title: "Üdvözöl a G2A Growth Engine! 🚀",
      text: "Ez egy gyors bemutató, amely végigvezet a főbb funkciókon. Bármikor kihagyhatod a jobb felső sarokban lévő × gombbal.",
      buttons: [
        btn("Kihagyás", () => tour.cancel(), true),
        btn("Kezdjük →", () => tour.next()),
      ],
    },
    {
      id: "dashboard",
      attachTo: { element: "a[href='/iranyitopult']", on: "right" },
      title: "Irányítópult",
      text: "Egy pillantással látod az aktív kampányokat, a legutóbbi leadeket és az AI-kvóta felhasználásodat.",
      buttons: [
        btn("← Vissza", () => tour.back(), true),
        btn("Következő →", () => tour.next()),
      ],
      scrollTo: false,
    },
    {
      id: "intelligence",
      attachTo: { element: "a[href='/intelligencia']", on: "right" },
      title: "Intelligencia",
      text: "AI-alapú piaci elemzés és versenytárs-figyelő. Kérdezz bármit a piacodról – az AI strukturált választ ad.",
      buttons: [
        btn("← Vissza", () => tour.back(), true),
        btn("Következő →", () => tour.next()),
      ],
      scrollTo: false,
    },
    {
      id: "strategy",
      attachTo: { element: "a[href='/strategia']", on: "right" },
      title: "Stratégia",
      text: "Generálj teljes marketing stratégiát egyetlen kattintással. Az AI az onboarding adataid alapján személyre szabott tervet készít.",
      buttons: [
        btn("← Vissza", () => tour.back(), true),
        btn("Következő →", () => tour.next()),
      ],
      scrollTo: false,
    },
    {
      id: "content",
      attachTo: { element: "a[href='/tartalom-studio']", on: "right" },
      title: "Tartalom Studio",
      text: "Tervezd meg és ütemezd a tartalmaidat. Az AI javaslatokat ad a posztok szövegéhez, és közvetlenül a közösségi médiára is közzéteheted.",
      buttons: [
        btn("← Vissza", () => tour.back(), true),
        btn("Következő →", () => tour.next()),
      ],
      scrollTo: false,
    },
    {
      id: "sales",
      attachTo: { element: "a[href='/ertekesites']", on: "right" },
      title: "Értékesítés",
      text: "Kövesd nyomon a leadeket és az e-mail kampányokat. Az AI automatikusan generál személyre szabott hideg e-maileket.",
      buttons: [
        btn("← Vissza", () => tour.back(), true),
        btn("Következő →", () => tour.next()),
      ],
      scrollTo: false,
    },
    {
      id: "settings",
      attachTo: { element: "a[href='/beallitasok']", on: "right" },
      title: "Beállítások",
      text: "Állítsd be a profilodat, a márkaidentitásodat és a csatlakoztatott közösségi fiókjaidat. Ezt a bemutatót bármikor újraindíthatod innen.",
      buttons: [
        btn("← Vissza", () => tour.back(), true),
        btn("Befejezés ✓", () => tour.complete()),
      ],
      scrollTo: false,
    },
  ];
}

function createTourInstance() {
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      cancelIcon: { enabled: true },
      classes: "g2a-shepherd-step",
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 8,
    },
  });

  const steps = buildSteps(tour);
  steps.forEach(step => tour.addStep(step));

  tour.on("complete", () => localStorage.setItem(TOUR_DONE_KEY, "1"));
  tour.on("cancel", () => localStorage.setItem(TOUR_DONE_KEY, "1"));

  return tour;
}

export function useTour() {
  const tourRef = useRef<any>(null);

  /** Automatikus indítás – csak ha még nem látta a felhasználó */
  useEffect(() => {
    const alreadySeen = localStorage.getItem(TOUR_DONE_KEY);
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      const tour = createTourInstance();
      tourRef.current = tour;
      tour.start();
    }, 1400);

    return () => clearTimeout(timer);
  }, []);

  /** Kézi újraindítás */
  const restartTour = useCallback(() => {
    if (tourRef.current?.isActive()) {
      tourRef.current.cancel();
    }
    localStorage.removeItem(TOUR_DONE_KEY);
    const tour = createTourInstance();
    tourRef.current = tour;
    tour.start();
  }, []);

  return { restartTour };
}
