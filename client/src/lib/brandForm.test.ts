import { describe, expect, it } from "vitest";
import { brandFormFor, draftToRules, linesToPhrases, rulesToDraft } from "./brandForm";

describe("brandForm", () => {
  it("az űrlap mindig az adott profil adataiból indul, hiányzó mezőnél alapértékkel", () => {
    const voice = { tone: "Barátságos", style: "", avoid: "", keywords: ["a"] };
    expect(brandFormFor({ primaryColor: "#111111", brandVoice: voice })).toEqual({
      primaryColor: "#111111", secondaryColor: "#10b981", fontHeading: "Sora", fontBody: "Inter", brandVoice: voice,
    });
    expect(brandFormFor({}).brandVoice).toEqual({ tone: "", style: "", avoid: "", keywords: [] });
  });

  it("soronként egy kifejezés, üres sor nélkül; a vessző nem választ el", () => {
    expect(linesToPhrases("első, második\r\n\r\n  harmadik  \n")).toEqual(["első, második", "harmadik"]);
  });

  it("oda-vissza alakítás; az üres záradék null", () => {
    const rules = { requiredPhrases: ["a, b", "c"], forbiddenPhrases: [], requiredDisclaimer: "Sor 1\nSor 2" };
    expect(draftToRules(rulesToDraft(rules))).toEqual(rules);
    expect(draftToRules({ required: "", forbidden: "", disclaimer: "  " })).toEqual({ requiredPhrases: [], forbiddenPhrases: [], requiredDisclaimer: null });
  });
});
