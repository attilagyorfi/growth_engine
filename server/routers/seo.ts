/**
 * G2A Growth Engine – SEO Audit router
 *
 * runAudit: weboldal letöltés + HTML elemzés (meta tagek, fejlécek,
 * képek alt szöveg, sitemap/robots.txt, strukturált adat) + AI insights
 * + AI recommendations + score 0-100. getAudits, deleteAudit.
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor 2. körében.
 */
import { z } from "zod";
import { appUserProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const seoRouter = router({
  runAudit: appUserProcedure
    .input(z.object({ profileId: z.string(), url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const { nanoid } = await import("nanoid");
      const id = nanoid();
      // Insert pending record
      const { getDb } = await import("../db");
      const { seoAudits } = await import("../../drizzle/schema");
      const db = await getDb();
      await db!.insert(seoAudits).values({ id, profileId: input.profileId, url: input.url, status: "running" });

      // Fetch the page HTML
      let html = "";
      let loadTime: number | null = null;
      let pageSize: number | null = null;
      let hasHttps = input.url.startsWith("https://");
      let hasSitemap = false;
      let hasRobotsTxt = false;
      try {
        const t0 = Date.now();
        const resp = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; G2A-SEO-Bot/1.0)" }, signal: AbortSignal.timeout(15000) });
        loadTime = Date.now() - t0;
        html = await resp.text();
        pageSize = Buffer.byteLength(html, "utf8");
      } catch { /* ignore fetch errors */ }

      // Check sitemap & robots.txt
      try {
        const base = new URL(input.url).origin;
        const [smResp, rbResp] = await Promise.allSettled([
          fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(5000) }),
        ]);
        hasSitemap = smResp.status === "fulfilled" && smResp.value.ok;
        hasRobotsTxt = rbResp.status === "fulfilled" && rbResp.value.ok;
      } catch { /* ignore */ }

      // Parse HTML with regex (no cheerio dependency)
      const getTag = (tag: string) => { const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i")); return m ? m[1].replace(/<[^>]+>/g, "").trim() : null; };
      const getMeta = (name: string) => { const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i")); return m ? m[1] : null; };
      const title = getTag("title");
      const description = getMeta("description");
      const ogTitle = getMeta("og:title");
      const ogDescription = getMeta("og:description");
      const ogImage = getMeta("og:image");
      const canonical = (() => { const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i); return m ? m[1] : null; })();
      const robots = getMeta("robots");
      const langAttr = (() => { const m = html.match(/<html[^>]+lang=["']([^"']*)["']/i); return m ? m[1] : null; })();
      const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
      const hasCharset = /<meta[^>]+charset/i.test(html);
      const hasFavicon = /<link[^>]+rel=["'](?:icon|shortcut icon)["']/i.test(html);
      const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
      const h1Texts = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map(m => m[1].replace(/<[^>]+>/g, "").trim()).slice(0, 5);
      const h2Texts = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map(m => m[1].replace(/<[^>]+>/g, "").trim()).slice(0, 8);
      const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
      const wordCount = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").length;
      const internalLinks = (html.match(new RegExp(`href=["'](?:\/|${input.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})[^"']*["']`, "gi")) || []).length;
      const externalLinks = (html.match(/href=["']https?:\/\/[^"']*/gi) || []).length - internalLinks;
      const totalImages = (html.match(/<img[^>]*>/gi) || []).length;
      const imagesWithoutAlt = (html.match(/<img(?![^>]*alt=["'][^"']+["'])[^>]*>/gi) || []).length;

      // Build issues list
      const issues: Array<{ severity: "critical" | "warning" | "info"; category: string; title: string; description: string; recommendation: string }> = [];
      if (!title) issues.push({ severity: "critical", category: "Meta", title: "Hiányzó title tag", description: "Az oldal nem rendelkezik title taggel.", recommendation: "Adj hozzá egy 50-60 karakter hosszú, kulcsszavakat tartalmazó title taget." });
      else if ((title?.length ?? 0) < 30) issues.push({ severity: "warning", category: "Meta", title: "Rövid title tag", description: `A title csak ${title?.length} karakter.`, recommendation: "Bővítsd 50-60 karakterre, és helyezd el a fő kulcsszót az elején." });
      else if ((title?.length ?? 0) > 60) issues.push({ severity: "warning", category: "Meta", title: "Hosszú title tag", description: `A title ${title?.length} karakter – a keresők csonkíthatják.`, recommendation: "Rövidítsd 60 karakterre." });
      if (!description) issues.push({ severity: "critical", category: "Meta", title: "Hiányzó meta description", description: "Nincs meta description.", recommendation: "Írj 150-160 karakteres, cselekvésre ösztönző meta descriptiont." });
      else if ((description?.length ?? 0) > 160) issues.push({ severity: "warning", category: "Meta", title: "Hosszú meta description", description: `A description ${description?.length} karakter.`, recommendation: "Rövidítsd 160 karakterre." });
      if (h1Texts.length === 0) issues.push({ severity: "critical", category: "Tartalom", title: "Hiányzó H1 fejléc", description: "Az oldalon nincs H1 fejléc.", recommendation: "Adj hozzá pontosan egy H1 fejlécet, amely tartalmazza a fő kulcsszót." });
      else if (h1Texts.length > 1) issues.push({ severity: "warning", category: "Tartalom", title: "Több H1 fejléc", description: `Az oldalon ${h1Texts.length} H1 fejléc van.`, recommendation: "Csak egy H1 fejléc legyen oldalanként." });
      if (!hasHttps) issues.push({ severity: "critical", category: "Technikai", title: "HTTPS hiányzik", description: "Az oldal nem HTTPS-en fut.", recommendation: "Telepíts SSL tanúsítványt és irányítsd át a HTTP forgalmat HTTPS-re." });
      if (!hasSitemap) issues.push({ severity: "warning", category: "Technikai", title: "Hiányzó sitemap.xml", description: "Nem található sitemap.xml.", recommendation: "Hozz létre és tedd közzé a sitemap.xml fájlt, majd add hozzá a Google Search Console-hoz." });
      if (!hasRobotsTxt) issues.push({ severity: "warning", category: "Technikai", title: "Hiányzó robots.txt", description: "Nem található robots.txt.", recommendation: "Hozz létre robots.txt fájlt a crawlerek irányításához." });
      if (!hasViewport) issues.push({ severity: "critical", category: "Mobilbarát", title: "Hiányzó viewport meta tag", description: "Nincs viewport meta tag – az oldal nem mobilbarát.", recommendation: "Add hozzá: <meta name='viewport' content='width=device-width, initial-scale=1'>" });
      if (!hasStructuredData) issues.push({ severity: "info", category: "Strukturált adat", title: "Nincs strukturált adat (JSON-LD)", description: "Az oldal nem tartalmaz schema.org jelölést.", recommendation: "Adj hozzá Organization, WebSite vagy LocalBusiness JSON-LD strukturált adatot." });
      if (imagesWithoutAlt > 0) issues.push({ severity: "warning", category: "Akadálymentesség", title: `${imagesWithoutAlt} kép alt szöveg nélkül`, description: `${imagesWithoutAlt} képből hiányzik az alt attribútum.`, recommendation: "Minden képhez adj leíró alt szöveget a keresőoptimalizálás és akadálymentesség érdekében." });
      if (!canonical) issues.push({ severity: "info", category: "Meta", title: "Hiányzó canonical URL", description: "Nincs canonical link tag.", recommendation: "Add hozzá a canonical URL-t a duplikált tartalom elkerülése érdekében." });
      if (!langAttr) issues.push({ severity: "info", category: "Technikai", title: "Hiányzó lang attribútum", description: "A HTML tag nem tartalmaz lang attribútumot.", recommendation: "Add hozzá a lang attribútumot, pl. lang='hu'." });
      if (wordCount < 300) issues.push({ severity: "warning", category: "Tartalom", title: "Kevés szöveges tartalom", description: `Az oldal csak ~${wordCount} szót tartalmaz.`, recommendation: "Bővítsd a tartalmat legalább 500 szóra a jobb rangsorolás érdekében." });

      // Calculate score
      const criticalCount = issues.filter(i => i.severity === "critical").length;
      const warningCount = issues.filter(i => i.severity === "warning").length;
      const score = Math.max(0, Math.min(100, 100 - criticalCount * 15 - warningCount * 5));

      // AI insights
      const auditSummary = `URL: ${input.url}\nTitle: ${title ?? "N/A"}\nDescription: ${description ?? "N/A"}\nH1: ${h1Texts[0] ?? "N/A"}\nWordCount: ${wordCount}\nHTTPS: ${hasHttps}\nSitemap: ${hasSitemap}\nStructuredData: ${hasStructuredData}\nIssues: ${issues.map(i => `[${i.severity}] ${i.title}`).join("; ")}\nScore: ${score}/100`;
      let aiInsights = "";
      let aiRecommendations = "";
      try {
        const aiResp = await invokeLLM({ messages: [
          { role: "system" as const, content: "Te egy SEO szakértő vagy. Elemezd a weboldal SEO audit eredményeit és adj részletes, szakmai értékelést magyarul. Légy konkrét és cselekvésre ösztönző." },
          { role: "user" as const, content: `Elemezd ezt a SEO auditot és adj átfogó értékelést:\n\n${auditSummary}\n\nÍrj 3-4 bekezdéses elemzést a weboldal SEO állapotáról, erősségeiről és gyengeségeiről.` },
        ] });
        const rawInsights = aiResp.choices?.[0]?.message?.content;
        aiInsights = typeof rawInsights === "string" ? rawInsights : "";
        const aiRecResp = await invokeLLM({ messages: [
          { role: "system" as const, content: "Te egy SEO szakértő vagy. Adj konkrét, prioritizált cselekvési tervet a weboldal SEO javításához magyarul. Számozd a lépéseket fontossági sorrendben." },
          { role: "user" as const, content: `Az alábbi SEO audit alapján adj 5-7 konkrét, megvalósítható javaslatot prioritási sorrendben:\n\n${auditSummary}` },
        ] });
        const rawRec = aiRecResp.choices?.[0]?.message?.content;
        aiRecommendations = typeof rawRec === "string" ? rawRec : "";
      } catch { /* AI failure is non-fatal */ }

      const report = {
        meta: { title, titleLength: title?.length ?? 0, description, descriptionLength: description?.length ?? 0, canonical, robots, ogTitle, ogDescription, ogImage },
        headings: { h1Count: h1Texts.length, h1Texts, h2Count: h2Texts.length, h2Texts, h3Count },
        performance: { loadTime, pageSize, hasHttps, hasSitemap, hasRobotsTxt },
        content: { wordCount, internalLinks, externalLinks, imagesWithoutAlt, totalImages },
        technical: { hasStructuredData, hasViewport, hasCharset, hasFavicon, langAttribute: langAttr },
        issues,
        aiInsights,
        aiRecommendations,
      };

      const { eq: eqSeo } = await import("drizzle-orm");
      await db!.update(seoAudits).set({ status: "done", score, report }).where(eqSeo(seoAudits.id, id));
      return { id, score, report };
    }),

  getAudits: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input }) => {
      const { getDb: getDb2 } = await import("../db");
      const { seoAudits } = await import("../../drizzle/schema");
      const { eq: eqSeo2, desc: descSeo } = await import("drizzle-orm");
      const db2 = await getDb2();
      const rows = await db2!.select().from(seoAudits).where(eqSeo2(seoAudits.profileId, input.profileId)).orderBy(descSeo(seoAudits.createdAt)).limit(10);
      return rows;
    }),

  deleteAudit: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb: getDb3 } = await import("../db");
      const { seoAudits } = await import("../../drizzle/schema");
      const { eq: eqSeo3 } = await import("drizzle-orm");
      const db3 = await getDb3();
      await db3!.delete(seoAudits).where(eqSeo3(seoAudits.id, input.id));
      return { ok: true };
    }),
});
