/**
 * G2A Growth Engine – Language Context (HU only)
 * Az angol nyelvű interfész egyelőre nem elérhető – csak magyar.
 * Az EN fordítások megtartva a jövőbeli bővítéshez, de a kapcsoló el van rejtve.
 */

import { createContext, useContext, type ReactNode } from "react";

export type Lang = "hu";

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  hu: {
    // Navigation
    nav_dashboard: "Irányítópult",
    nav_clients: "Ügyfelek",
    nav_strategy: "Stratégia",
    nav_content_studio: "Tartalom Studio",
    nav_sales_ops: "Értékesítés",
    nav_analytics: "Analitika",
    nav_settings: "Beállítások",
    nav_users: "Felhasználók",
    nav_logout: "Kijelentkezés",

    // Auth
    auth_login: "Bejelentkezés",
    auth_register: "Regisztráció",
    auth_email: "Email cím",
    auth_password: "Jelszó",
    auth_confirm_password: "Jelszó megerősítése",
    auth_name: "Teljes név",
    auth_forgot_password: "Elfelejtett jelszó",
    auth_reset_password: "Jelszó visszaállítása",
    auth_no_account: "Még nincs fiókod?",
    auth_have_account: "Már van fiókod?",
    auth_login_here: "Jelentkezz be itt",
    auth_register_here: "Regisztrálj itt",
    auth_free_trial: "Ingyenes próba",
    auth_start_free: "Kezdj el ingyen",

    // Landing
    landing_hero_title: "Marketing stratégia, AI sebességgel",
    landing_hero_subtitle: "A G2A Growth Engine AI-alapú marketing operációs rendszer, amely segít a vállalkozásodnak stratégiát alkotni, tartalmat gyártani és leadeket generálni.",
    landing_features: "Funkciók",
    landing_how_it_works: "Hogyan működik",
    landing_pricing: "Árazás",
    landing_cta: "Kezdd el ingyen",
    landing_learn_more: "Tudj meg többet",

    // Onboarding
    onboarding_title: "G2A Growth Engine beállítása",
    onboarding_step1: "Alapadatok",
    onboarding_step2: "Brand & Hang",
    onboarding_step3: "Működés",
    onboarding_step4: "WOW Kimenet",
    onboarding_next: "Következő",
    onboarding_back: "Vissza",
    onboarding_finish: "Befejezés",
    onboarding_generating: "Elemzés folyamatban...",
    onboarding_help: "Segítség",
    onboarding_skip_help: "Bezárás",

    // Onboarding help texts
    help_company_name: "Add meg a vállalkozásod nevét, ahogy az ügyfeleid ismerik. Ez lesz az összes generált tartalom alapja.",
    help_website: "A weboldal elemzésével az AI automatikusan kitölti a cég leírását, szolgáltatásait és célközönségét. Kattints az 'Elemzés' gombra a gyors kitöltéshez.",
    help_industry: "Az iparág meghatározza, milyen típusú tartalmakat és stratégiákat javasol az AI. Válaszd a legpontosabb kategóriát.",
    help_services: "Sorold fel a főbb szolgáltatásaidat vagy termékeidet. Ezek alapján az AI személyre szabott marketing üzeneteket alkot.",
    help_target_audience: "Írd le az ideális ügyfeled: ki ő, milyen problémái vannak, mit keres. Minél pontosabb, annál jobb a generált tartalom.",
    help_competitors: "A versenytársak ismerete segít az AI-nak megkülönböztető üzeneteket alkotni. Add meg a főbb versenytársak nevét vagy weboldalát.",
    help_tone: "A hangnem meghatározza, hogyan kommunikál a márkád. Válaszd azt, ami legjobban illik a vállalkozásod személyiségéhez.",
    help_brand_keywords: "Ezek a szavak mindig megjelennek a generált tartalmakban. Gondolj olyan szavakra, amelyek a márkád értékeit tükrözik.",
    help_avoid_words: "Ezeket a szavakat az AI kerüli a tartalmakban. Hasznos, ha vannak iparági klisék vagy nem kívánatos kifejezések.",
    help_channels: "Jelöld meg, melyik csatornákon vagy aktív. Az AI ezekre optimalizálja a tartalmakat (pl. LinkedIn poszt vs. Instagram caption).",
    help_main_goal: "A fő cél alapján az AI priorizálja a javaslatokat. Ha például lead generálás a cél, több CTA-t és konverziós tartalmat javasol.",
    help_wow_output: "Az AI most elemzi az összes megadott adatot és személyre szabott marketing stratégiát, tartalom pilléreket és quick win javaslatokat készít.",

    // Dashboard
    dashboard_welcome: "Üdvözöljük",
    dashboard_needs_approval: "Jóváhagyásra vár",
    dashboard_this_week: "Ezen a héten",
    dashboard_scheduled: "Ütemezett (7 nap)",
    dashboard_top_insight: "Top Insight",
    dashboard_at_risk: "Kockázatos elemek",

    // Common
    common_save: "Mentés",
    common_cancel: "Mégse",
    common_delete: "Törlés",
    common_edit: "Szerkesztés",
    common_add: "Hozzáadás",
    common_search: "Keresés",
    common_loading: "Betöltés...",
    common_error: "Hiba történt",
    common_success: "Sikeres",
    common_confirm: "Megerősítés",
    common_close: "Bezárás",
    common_back: "Vissza",
    common_next: "Következő",
    common_finish: "Befejezés",
    common_yes: "Igen",
    common_no: "Nem",
    common_status_active: "Aktív",
    common_status_inactive: "Inaktív",
    common_status_draft: "Vázlat",
    common_status_published: "Publikált",
    common_status_pending: "Függőben",

    // Language switcher (hidden, reserved for future use)
    lang_switch_to: "Switch to English",
  },
} as const;

export type TranslationKey = keyof typeof translations.hu;

// ─── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always HU – language switcher is disabled until EN translations are complete
  const lang: Lang = "hu";

  const setLang = (_newLang: Lang) => {
    // No-op: EN not available yet
  };

  const toggleLang = () => {
    // No-op: EN not available yet
  };

  const t = (key: TranslationKey): string => {
    return translations.hu[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
