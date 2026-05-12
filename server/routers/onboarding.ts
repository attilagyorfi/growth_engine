/**
 * G2A Growth Engine – Onboarding router
 *
 * Onboarding session + answers, weboldal scrape (HTML letöltés + AI elemzés),
 * brand asset upload (S3 + AI parse), social profile scrape + AI elemzés.
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor során.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { appUserProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import {
  getOnboardingSession, upsertOnboardingSession, saveOnboardingAnswers, getOnboardingAnswers,
  getBrandAssets, createBrandAsset, updateBrandAssetParsed, deleteBrandAsset,
} from "../db";
import {
  getSocialProfileCache, upsertSocialProfileCache,
} from "../projectsDb";

export const onboardingRouter = router({
  getSession: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(({ input }) => getOnboardingSession(input.profileId)),

  upsertSession: appUserProcedure
    .input(z.object({
      id: z.string().optional(),
      profileId: z.string(),
      status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
      currentStep: z.number().optional(),
      completedAt: z.coerce.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = input.id ?? nanoid();
      return upsertOnboardingSession({ id, profileId: input.profileId, status: input.status ?? "in_progress", currentStep: input.currentStep ?? 1, completedAt: input.completedAt ?? null });
    }),

  saveAnswers: appUserProcedure
    .input(z.object({
      sessionId: z.string(),
      profileId: z.string(),
      step: z.number(),
      answers: z.array(z.object({
        fieldKey: z.string(),
        fieldValue: z.string().nullable().optional(),
        aiGenerated: z.boolean().optional(),
        userConfirmed: z.boolean().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const rows = input.answers.map(a => ({
        sessionId: input.sessionId,
        profileId: input.profileId,
        step: input.step,
        fieldKey: a.fieldKey,
        fieldValue: a.fieldValue ?? null,
        aiGenerated: a.aiGenerated ?? false,
        userConfirmed: a.userConfirmed ?? false,
      }));
      return saveOnboardingAnswers(rows);
    }),

  getAnswers: appUserProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ input }) => getOnboardingAnswers(input.sessionId)),

  scrapeWebsite: appUserProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      // Step 1: Fetch the actual HTML content of the website
      let htmlContent = "";
      let fetchError = "";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(input.url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; G2A-Scraper/1.0; +https://g2a.marketing)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
          },
        });
        clearTimeout(timeoutId);
        const rawHtml = await res.text();
        // Extract key text: title, meta tags, h1-h3, nav links, footer
        const extractText = (html: string): string => {
          // Remove scripts, styles, comments
          let clean = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<!--[\s\S]*?-->/g, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          return clean.slice(0, 4000);
        };
        // Extract specific meta tags
        const getMetaContent = (html: string, name: string): string => {
          const patterns = [
            new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
          ];
          for (const p of patterns) { const m = html.match(p); if (m) return m[1]; }
          return "";
        };
        const title = (rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
        const metaDesc = getMetaContent(rawHtml, "description") || getMetaContent(rawHtml, "og:description");
        const ogTitle = getMetaContent(rawHtml, "og:title") || getMetaContent(rawHtml, "twitter:title");
        const ogSiteName = getMetaContent(rawHtml, "og:site_name");
        const keywords = getMetaContent(rawHtml, "keywords");
        const bodyText = extractText(rawHtml);
        htmlContent = [
          title ? `TITLE: ${title}` : "",
          ogSiteName ? `SITE NAME: ${ogSiteName}` : "",
          ogTitle ? `OG TITLE: ${ogTitle}` : "",
          metaDesc ? `META DESCRIPTION: ${metaDesc}` : "",
          keywords ? `KEYWORDS: ${keywords}` : "",
          `BODY TEXT (first 3000 chars): ${bodyText}`,
        ].filter(Boolean).join("\n");
      } catch (e: any) {
        fetchError = `Weboldal nem volt elérhető (${e?.message ?? "timeout"}). Az URL és domain név alapján elemzem.`;
      }

      // Step 2: AI analysis with real content (or fallback to URL-only)
      const contextBlock = htmlContent
        ? `A weboldal valódi tartalma:\n${htmlContent}`
        : `FIGYELEM: ${fetchError} URL: ${input.url}`;

      const prompt = `Te egy marketing elemző vagy. Elemezd a következő weboldalt: ${input.url}\n\n${contextBlock}\n\nA fenti valódi weboldal tartalom alapján határozott, tényközlő stílusban írj le mindent a vállalkozásról. TILOS feltételes megfogalmazást használni. CSAK a weboldalón ténylegesen megtalálható információkat használd. MINDEN szöveges választ KIZÁRÓLAG MAGYARUL adj meg.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Te egy marketing elemző vagy, aki strukturált adatokat nyér ki weboldal tartalmakból. CSAK a megadott weboldal tartalmában lévő tényleges információkat használd. TILOS feltételezni vagy kitalálni adatokat. MINDIG érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "website_analysis", strict: true, schema: { type: "object", properties: { companyName: { type: "string" }, industry: { type: "string" }, services: { type: "array", items: { type: "string" } }, keyMessages: { type: "array", items: { type: "string" } }, toneOfVoice: { type: "string" }, targetAudience: { type: "string" }, ctas: { type: "array", items: { type: "string" } }, competitorCandidates: { type: "array", items: { type: "string" } }, companySummary: { type: "string" } }, required: ["companyName", "industry", "services", "keyMessages", "toneOfVoice", "targetAudience", "ctas", "competitorCandidates", "companySummary"], additionalProperties: false } } },
      });
      const content = response.choices[0]?.message?.content ?? "{}";
      return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    }),

  uploadAsset: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      fileBase64: z.string(),
      assetType: z.enum(["brand_guide", "visual_identity", "sales_material", "strategy", "buyer_persona", "faq", "other"]),
    }))
    .mutation(async ({ input }) => {
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `brand-assets/${input.profileId}/${nanoid()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.fileType);
      const asset = await createBrandAsset({
        id: nanoid(),
        profileId: input.profileId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileUrl: url,
        fileKey,
        assetType: input.assetType,
      });
      invokeLLM({
        messages: [
          { role: "system", content: "Te egy márkaelemző vagy. Kulcs márkainformációkat nyérsz ki feltöltött dokumentumokból. MINDEN szöveget KIZÁRÓLAG MAGYARUL adj meg." },
          { role: "user", content: `Elemezd ezt a ${input.assetType} dokumentumot (${input.fileName}) és nyérd ki: márkaértékek, kommunikációs stílus, fő üzenetek, célcsoport, vizuális irányelvek és minden egyéb releváns marketing információ. Adj vissza strukturált szöveges összefoglalót MAGYARUL.` },
        ],
      }).then(async (res) => {
        const parsed = res.choices[0]?.message?.content;
        if (parsed && asset?.id) {
          await updateBrandAssetParsed(asset.id, typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        }
      }).catch(console.error);
      return asset;
    }),

  getBrandAssets: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(({ input }) => getBrandAssets(input.profileId)),

  deleteBrandAsset: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => deleteBrandAsset(input.id)),

  scrapeSocialProfile: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      platform: z.string(), // linkedin, facebook, instagram, tiktok, youtube
      url: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check cache first (1 hour TTL)
      const cached = await getSocialProfileCache(input.profileId, input.platform, input.url);
      if (cached && cached.scrapedAt) {
        const ageMs = Date.now() - new Date(cached.scrapedAt).getTime();
        if (ageMs < 3600_000) return cached.analysis;
      }

      // Step 1: Try to fetch publicly visible content from the social profile page
      let pageContent = "";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(input.url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; G2A-Scraper/1.0)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
          },
        });
        clearTimeout(timeoutId);
        const html = await res.text();
        // Extract visible text (social pages have limited public content)
        const getMetaContent = (h: string, name: string): string => {
          const p1 = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
          const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i");
          return h.match(p1)?.[1] ?? h.match(p2)?.[1] ?? "";
        };
        const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
        const ogDesc = getMetaContent(html, "og:description") || getMetaContent(html, "description");
        const ogTitle = getMetaContent(html, "og:title") || getMetaContent(html, "twitter:title");
        const ogSiteName = getMetaContent(html, "og:site_name");
        const cleanBody = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<!--[\s\S]*?-->/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000);
        pageContent = [
          title ? `TITLE: ${title}` : "",
          ogSiteName ? `SITE: ${ogSiteName}` : "",
          ogTitle ? `OG TITLE: ${ogTitle}` : "",
          ogDesc ? `DESCRIPTION: ${ogDesc}` : "",
          cleanBody ? `PAGE TEXT: ${cleanBody}` : "",
        ].filter(Boolean).join("\n");
      } catch {
        // Social platforms often block scrapers – fall back to URL-based analysis
        pageContent = "";
      }

      // Step 2: AI analysis with whatever content we got
      const contextNote = pageContent
        ? `A profil oldalról kinyert tartalom:\n${pageContent}`
        : `A profil URL: ${input.url} (a ${input.platform} platform nem engedte a közvetlen adatkinyerést, így csak a URL és platform-specifikus ismeretek alapján elemzem)`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Te egy közösségi média elemző vagy. A megadott profil URL és az esetlegesen kinyert tartalom alapján határozott, tényközlő stílusban elemzed a profilt. TILOS feltételes megfogalmazást használni. MINDEN szöveges választ KIZÁRÓLAG MAGYARUL adj meg. Adj vissza kizárólag érvényes JSON-t." },
          { role: "user", content: `Elemezd ezt a ${input.platform} profilt: ${input.url}\n\n${contextNote}\n\nAdj vissza JSON-t a profil kommunikációjáról: tone (hangvitel magyarul), contentTypes (tartalom típusok tömb magyarul), postFrequency (becsült poszt frekvencia magyarul), topTopics (fő témakörök tömb magyarul), engagementStyle (elköteleződési stílus magyarul), audienceSignals (célcsoport jelzők tömb magyarul), rawSummary (rövid összefoglaló magyarul - csak tényeket, ne feltételezéseket)` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "social_profile_analysis", strict: true, schema: { type: "object", properties: { tone: { type: "string" }, contentTypes: { type: "array", items: { type: "string" } }, postFrequency: { type: "string" }, topTopics: { type: "array", items: { type: "string" } }, engagementStyle: { type: "string" }, audienceSignals: { type: "array", items: { type: "string" } }, rawSummary: { type: "string" } }, required: ["tone", "contentTypes", "postFrequency", "topTopics", "engagementStyle", "audienceSignals", "rawSummary"], additionalProperties: false } } },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      const analysis = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      await upsertSocialProfileCache({
        id: nanoid(),
        profileId: input.profileId,
        platform: input.platform,
        url: input.url,
        analysis,
        scrapedAt: new Date(),
      });
      return analysis;
    }),
});
