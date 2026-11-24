/** A Beállítások → Márka űrlapjának tiszta segédei. */

type BrandFormSource = {
  primaryColor?: string; secondaryColor?: string; fontHeading?: string; fontBody?: string;
  brandVoice?: { tone: string; style: string; avoid: string; keywords: string[] } | null;
};

/** Az űrlap kezdőértékei az adott profilból. */
export function brandFormFor(profile: BrandFormSource) {
  return {
    primaryColor: profile.primaryColor ?? "#6366f1",
    secondaryColor: profile.secondaryColor ?? "#10b981",
    fontHeading: profile.fontHeading ?? "Sora",
    fontBody: profile.fontBody ?? "Inter",
    brandVoice: profile.brandVoice ?? { tone: "", style: "", avoid: "", keywords: [] },
  };
}

/** Soronként egy kifejezés; a vesszőt tartalmazó egyben marad. */
export const linesToPhrases = (text: string): string[] => text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter(Boolean);

export type BrandRulesDraft = { required: string; forbidden: string; disclaimer: string };

export const rulesToDraft = (rules: { requiredPhrases: string[]; forbiddenPhrases: string[]; requiredDisclaimer: string | null }): BrandRulesDraft => ({
  required: rules.requiredPhrases.join("\n"),
  forbidden: rules.forbiddenPhrases.join("\n"),
  disclaimer: rules.requiredDisclaimer ?? "",
});

export const draftToRules = (draft: BrandRulesDraft) => ({
  requiredPhrases: linesToPhrases(draft.required),
  forbiddenPhrases: linesToPhrases(draft.forbidden),
  requiredDisclaimer: draft.disclaimer.trim() || null,
});
