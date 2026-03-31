/**
 * G2A Growth Engine – Language Context (HU/EN)
 * Simple i18n without external dependencies
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "hu" | "en";

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

    // Language switcher
    lang_switch_to: "Switch to English",
  },
  en: {
    // Navigation
    nav_dashboard: "Dashboard",
    nav_clients: "Clients",
    nav_strategy: "Strategy",
    nav_content_studio: "Content Studio",
    nav_sales_ops: "Sales Ops",
    nav_analytics: "Analytics",
    nav_settings: "Settings",
    nav_users: "Users",
    nav_logout: "Logout",

    // Auth
    auth_login: "Login",
    auth_register: "Register",
    auth_email: "Email address",
    auth_password: "Password",
    auth_confirm_password: "Confirm password",
    auth_name: "Full name",
    auth_forgot_password: "Forgot password",
    auth_reset_password: "Reset password",
    auth_no_account: "Don't have an account?",
    auth_have_account: "Already have an account?",
    auth_login_here: "Login here",
    auth_register_here: "Register here",
    auth_free_trial: "Free trial",
    auth_start_free: "Start for free",

    // Landing
    landing_hero_title: "Marketing strategy, at AI speed",
    landing_hero_subtitle: "G2A Growth Engine is an AI-powered marketing operating system that helps your business create strategy, produce content and generate leads.",
    landing_features: "Features",
    landing_how_it_works: "How it works",
    landing_pricing: "Pricing",
    landing_cta: "Start for free",
    landing_learn_more: "Learn more",

    // Onboarding
    onboarding_title: "Setting up G2A Growth Engine",
    onboarding_step1: "Basic Data",
    onboarding_step2: "Brand & Voice",
    onboarding_step3: "Operations",
    onboarding_step4: "WOW Output",
    onboarding_next: "Next",
    onboarding_back: "Back",
    onboarding_finish: "Finish",
    onboarding_generating: "Analyzing...",
    onboarding_help: "Help",
    onboarding_skip_help: "Close",

    // Onboarding help texts
    help_company_name: "Enter your business name as your clients know it. This will be the basis for all generated content.",
    help_website: "By analyzing your website, the AI automatically fills in the company description, services and target audience. Click 'Analyze' for quick completion.",
    help_industry: "The industry determines what types of content and strategies the AI suggests. Choose the most accurate category.",
    help_services: "List your main services or products. Based on these, the AI creates personalized marketing messages.",
    help_target_audience: "Describe your ideal customer: who they are, what problems they have, what they're looking for. The more precise, the better the generated content.",
    help_competitors: "Knowing competitors helps the AI create differentiating messages. Add the names or websites of main competitors.",
    help_tone: "The tone defines how your brand communicates. Choose what best fits your business personality.",
    help_brand_keywords: "These words always appear in generated content. Think of words that reflect your brand values.",
    help_avoid_words: "The AI avoids these words in content. Useful if there are industry clichés or unwanted expressions.",
    help_channels: "Mark which channels you're active on. The AI optimizes content for these (e.g. LinkedIn post vs. Instagram caption).",
    help_main_goal: "Based on the main goal, the AI prioritizes suggestions. If lead generation is the goal, it suggests more CTAs and conversion content.",
    help_wow_output: "The AI is now analyzing all provided data and creating personalized marketing strategy, content pillars and quick win suggestions.",

    // Dashboard
    dashboard_welcome: "Welcome",
    dashboard_needs_approval: "Needs Approval",
    dashboard_this_week: "This Week",
    dashboard_scheduled: "Scheduled (7 days)",
    dashboard_top_insight: "Top Insight",
    dashboard_at_risk: "At-risk Items",

    // Common
    common_save: "Save",
    common_cancel: "Cancel",
    common_delete: "Delete",
    common_edit: "Edit",
    common_add: "Add",
    common_search: "Search",
    common_loading: "Loading...",
    common_error: "An error occurred",
    common_success: "Success",
    common_confirm: "Confirm",
    common_close: "Close",
    common_back: "Back",
    common_next: "Next",
    common_finish: "Finish",
    common_yes: "Yes",
    common_no: "No",
    common_status_active: "Active",
    common_status_inactive: "Inactive",
    common_status_draft: "Draft",
    common_status_published: "Published",
    common_status_pending: "Pending",

    // Language switcher
    lang_switch_to: "Váltás magyarra",
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
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("g2a_lang");
    return (saved === "en" || saved === "hu") ? saved : "hu";
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("g2a_lang", newLang);
  };

  const toggleLang = () => setLang(lang === "hu" ? "en" : "hu");

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations.hu[key] ?? key;
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
