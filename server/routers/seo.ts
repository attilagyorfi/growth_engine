/**
 * G2A Growth Engine – SEO Audit router (v2)
 *
 * Three big upgrades from v1:
 *   1) Cheerio-alapú robusztus HTML parsing (regex helyett).
 *   2) Google PageSpeed Insights integráció — valódi Core Web Vitals
 *      (LCP, FID/INP, CLS, mobile + desktop performance score) helyett a
 *      sima HTML letöltési idő. API key NEM kötelező, de éles használathoz
 *      ajánlott (PAGESPEED_API_KEY env).
 *   3) Mini-crawl: a homepage + max 4 belső link, broken link check (HEAD
 *      kérések az összes externál + a belső linkekre). 5 másodperc fix
 *      timeout-tal, párhuzamosan.
 *
 * A v1-es API megtartva (runAudit/getAudits/deleteAudit), a report shape
 * bővítve `pageSpeed`, `crawledPages`, `brokenLinks` mezőkkel — a régi
 * frontend ezeket figyelmen kívül hagyja (nincs törésalapú változtatás).
 */
import { z } from "zod";
import { appUserProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import * as cheerio from "cheerio";

// ─── PageSpeed Insights ───────────────────────────────────────────────────

type PageSpeedResult = {
  strategy: "mobile" | "desktop";
  performanceScore: number | null;   // 0-100 (Google adja, mi átalakítjuk 100-as skálára)
  lcp: number | null;                 // Largest Contentful Paint, ms
  cls: number | null;                 // Cumulative Layout Shift, dimenziónélküli (jó < 0.1)
  inp: number | null;                 // Interaction to Next Paint, ms (FID utódja)
  ttfb: number | null;                // Time to First Byte, ms
  fcp: number | null;                 // First Contentful Paint, ms
  error?: string;
};

async function fetchPageSpeed(url: string, strategy: "mobile" | "desktop"): Promise<PageSpeedResult> {
  const base = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";
  const params = new URLSearchParams({ url, strategy, category: "performance" });
  if (ENV.pagespeedApiKey) params.set("key", ENV.pagespeedApiKey);
  try {
    const resp = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) {
      return { strategy, performanceScore: null, lcp: null, cls: null, inp: null, ttfb: null, fcp: null,
        error: `PageSpeed API ${resp.status}: ${resp.statusText}` };
    }
    const data = await resp.json() as any;
    const lighthouse = data?.lighthouseResult;
    const audits = lighthouse?.audits ?? {};
    const perfScore = lighthouse?.categories?.performance?.score;
    return {
      strategy,
      performanceScore: typeof perfScore === "number" ? Math.round(perfScore * 100) : null,
      lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      // INP új neve a CWV-ben; régebben FID volt. Mindkettőt elfogadjuk.
      inp: audits["interaction-to-next-paint"]?.numericValue
        ?? audits["max-potential-fid"]?.numericValue
        ?? null,
      ttfb: audits["server-response-time"]?.numericValue ?? null,
      fcp: audits["first-contentful-paint"]?.numericValue ?? null,
    };
  } catch (e: any) {
    return { strategy, performanceScore: null, lcp: null, cls: null, inp: null, ttfb: null, fcp: null,
      error: e?.message ?? "PageSpeed hívás meghiúsult" };
  }
}

// ─── Mini-crawl + broken link check ───────────────────────────────────────

type CrawledPage = { url: string; status: number | null; title: string | null; wordCount: number; error?: string };
type BrokenLink = { url: string; status: number | null; source: string; type: "internal" | "external" };

async function checkLink(url: string): Promise<number | null> {
  try {
    // HEAD a leggyorsabb, de sok szerver 405-öt ad → fallback GET range:0-0
    const resp = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; G2A-SEO-Bot/2.0)" }});
    if (resp.status >= 400 && resp.status !== 405) return resp.status;
    if (resp.status === 405) {
      // Próbáljuk GET-tel, csak az 1 byte-ot kérjük
      const r2 = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; G2A-SEO-Bot/2.0)", range: "bytes=0-0" }});
      return r2.status;
    }
    return resp.status;
  } catch {
    return null;
  }
}

async function fetchAndParse(url: string): Promise<{ html: string; status: number | null; loadTime: number; pageSize: number }> {
  const t0 = Date.now();
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; G2A-SEO-Bot/2.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await resp.text();
    return { html, status: resp.status, loadTime: Date.now() - t0, pageSize: Buffer.byteLength(html, "utf8") };
  } catch {
    return { html: "", status: null, loadTime: Date.now() - t0, pageSize: 0 };
  }
}

export const seoRouter = router({
  runAudit: appUserProcedure
    .input(z.object({ profileId: z.string(), url: z.string().url() }))
    .mutation(async ({ input }) => {
      const { nanoid } = await import("nanoid");
      const id = nanoid();
      const { getDb } = await import("../db");
      const { seoAudits } = await import("../../drizzle/schema");
      const db = await getDb();
      await db!.insert(seoAudits).values({ id, profileId: input.profileId, url: input.url, status: "running" });

      // ── 1. Fő oldal letöltése + cheerio parsing ───────────────────────
      const main = await fetchAndParse(input.url);
      const html = main.html;
      const hasHttps = input.url.startsWith("https://");
      const $ = html ? cheerio.load(html) : cheerio.load("");

      const title = $("title").first().text().trim() || null;
      const description = $('meta[name="description"]').attr("content")?.trim() || null;
      const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || null;
      const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() || null;
      const ogImage = $('meta[property="og:image"]').attr("content")?.trim() || null;
      const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
      const robots = $('meta[name="robots"]').attr("content")?.trim() || null;
      const langAttr = $("html").attr("lang") || null;
      const hasViewport = $('meta[name="viewport"]').length > 0;
      const hasCharset = $("meta[charset], meta[http-equiv='Content-Type']").length > 0;
      const hasFavicon = $('link[rel="icon"], link[rel="shortcut icon"]').length > 0;
      const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

      const h1Texts = $("h1").map((_i: number, el: any) => $(el).text().trim()).get().slice(0, 5);
      const h2Texts = $("h2").map((_i: number, el: any) => $(el).text().trim()).get().slice(0, 8);
      const h3Count = $("h3").length;

      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      const wordCount = bodyText ? bodyText.split(" ").length : 0;

      // Linkek osztályozása
      const allLinks: { href: string; absolute: string; isInternal: boolean }[] = [];
      const origin = (() => { try { return new URL(input.url).origin; } catch { return ""; } })();
      $("a[href]").each((_i: number, el: any) => {
        const href = ($(el).attr("href") ?? "").trim();
        if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        let absolute = href;
        try { absolute = new URL(href, input.url).toString(); } catch { return; }
        const isInternal = origin ? absolute.startsWith(origin) : false;
        allLinks.push({ href, absolute, isInternal });
      });
      const internalLinks = allLinks.filter(l => l.isInternal).length;
      const externalLinks = allLinks.filter(l => !l.isInternal).length;

      // Képek alt szöveg
      const images = $("img");
      const totalImages = images.length;
      const imagesWithoutAlt = images.filter((_i: number, el: any) => !($(el).attr("alt") ?? "").trim()).length;

      // ── 2. Sitemap + robots.txt párhuzamosan ──────────────────────────
      let hasSitemap = false, hasRobotsTxt = false;
      if (origin) {
        const [sm, rb] = await Promise.allSettled([
          fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) }),
          fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) }),
        ]);
        hasSitemap = sm.status === "fulfilled" && sm.value.ok;
        hasRobotsTxt = rb.status === "fulfilled" && rb.value.ok;
      }

      // ── 3. PageSpeed Insights párhuzamosan (mobile + desktop) ─────────
      const [pageSpeedMobile, pageSpeedDesktop] = await Promise.all([
        fetchPageSpeed(input.url, "mobile"),
        fetchPageSpeed(input.url, "desktop"),
      ]);

      // ── 4. Mini-crawl: a homepage + max 4 belső link ──────────────────
      // Csak az első 4 EGYEDI internal linket vesszük (kivéve a homepage-et).
      const uniqueInternals = Array.from(new Set(
        allLinks.filter(l => l.isInternal).map(l => l.absolute)
      )).filter(u => u !== input.url).slice(0, 4);

      const crawlResults: CrawledPage[] = await Promise.all(uniqueInternals.map(async (u) => {
        try {
          const page = await fetchAndParse(u);
          const $$ = page.html ? cheerio.load(page.html) : cheerio.load("");
          const pageTitle = $$("title").first().text().trim() || null;
          const pageWords = $$("body").text().replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
          return { url: u, status: page.status, title: pageTitle, wordCount: pageWords };
        } catch (e: any) {
          return { url: u, status: null, title: null, wordCount: 0, error: e?.message };
        }
      }));

      // ── 5. Broken link check: első 10 external + 5 internal ────────────
      const linksToCheck: Array<{ url: string; type: "internal" | "external"; source: string }> = [];
      const externalsUnique = Array.from(new Set(allLinks.filter(l => !l.isInternal).map(l => l.absolute))).slice(0, 10);
      const internalsUnique = Array.from(new Set(allLinks.filter(l => l.isInternal).map(l => l.absolute))).slice(0, 5);
      externalsUnique.forEach(u => linksToCheck.push({ url: u, type: "external", source: input.url }));
      internalsUnique.forEach(u => linksToCheck.push({ url: u, type: "internal", source: input.url }));

      const linkStatuses = await Promise.all(linksToCheck.map(async (l) => ({ ...l, status: await checkLink(l.url) })));
      const brokenLinks: BrokenLink[] = linkStatuses.filter(l => l.status === null || l.status >= 400);

      // ── 6. Issues lista ─────────────────────────────────────────────────
      const issues: Array<{ severity: "critical" | "warning" | "info"; category: string; title: string; description: string; recommendation: string }> = [];
      if (!title) issues.push({ severity: "critical", category: "Meta", title: "Hiányzó title tag", description: "Az oldal nem rendelkezik title taggel.", recommendation: "Adj hozzá egy 50-60 karakter hosszú, kulcsszavakat tartalmazó title taget." });
      else if (title.length < 30) issues.push({ severity: "warning", category: "Meta", title: "Rövid title tag", description: `A title csak ${title.length} karakter.`, recommendation: "Bővítsd 50-60 karakterre, és helyezd el a fő kulcsszót az elején." });
      else if (title.length > 60) issues.push({ severity: "warning", category: "Meta", title: "Hosszú title tag", description: `A title ${title.length} karakter – a keresők csonkíthatják.`, recommendation: "Rövidítsd 60 karakterre." });
      if (!description) issues.push({ severity: "critical", category: "Meta", title: "Hiányzó meta description", description: "Nincs meta description.", recommendation: "Írj 150-160 karakteres, cselekvésre ösztönző meta descriptiont." });
      else if (description.length > 160) issues.push({ severity: "warning", category: "Meta", title: "Hosszú meta description", description: `A description ${description.length} karakter.`, recommendation: "Rövidítsd 160 karakterre." });
      if (h1Texts.length === 0) issues.push({ severity: "critical", category: "Tartalom", title: "Hiányzó H1 fejléc", description: "Az oldalon nincs H1 fejléc.", recommendation: "Adj hozzá pontosan egy H1 fejlécet, amely tartalmazza a fő kulcsszót." });
      else if (h1Texts.length > 1) issues.push({ severity: "warning", category: "Tartalom", title: "Több H1 fejléc", description: `Az oldalon ${h1Texts.length} H1 fejléc van.`, recommendation: "Csak egy H1 fejléc legyen oldalanként." });
      if (!hasHttps) issues.push({ severity: "critical", category: "Technikai", title: "HTTPS hiányzik", description: "Az oldal nem HTTPS-en fut.", recommendation: "Telepíts SSL tanúsítványt és irányítsd át a HTTP forgalmat HTTPS-re." });
      if (!hasSitemap) issues.push({ severity: "warning", category: "Technikai", title: "Hiányzó sitemap.xml", description: "Nem található sitemap.xml.", recommendation: "Hozz létre és tedd közzé a sitemap.xml fájlt, majd add hozzá a Google Search Console-hoz." });
      if (!hasRobotsTxt) issues.push({ severity: "warning", category: "Technikai", title: "Hiányzó robots.txt", description: "Nem található robots.txt.", recommendation: "Hozz létre robots.txt fájlt a crawlerek irányításához." });
      if (!hasViewport) issues.push({ severity: "critical", category: "Mobilbarát", title: "Hiányzó viewport meta tag", description: "Nincs viewport meta tag – az oldal nem mobilbarát.", recommendation: "Add hozzá: <meta name='viewport' content='width=device-width, initial-scale=1'>" });
      if (!hasStructuredData) issues.push({ severity: "info", category: "Strukturált adat", title: "Nincs strukturált adat (JSON-LD)", description: "Az oldal nem tartalmaz schema.org jelölést.", recommendation: "Adj hozzá Organization, WebSite vagy LocalBusiness JSON-LD strukturált adatot." });
      if (imagesWithoutAlt > 0) issues.push({ severity: "warning", category: "Akadálymentesség", title: `${imagesWithoutAlt} kép alt szöveg nélkül`, description: `${totalImages} képből ${imagesWithoutAlt} nem tartalmaz alt attribútumot.`, recommendation: "Minden képhez adj leíró alt szöveget a keresőoptimalizálás és akadálymentesség érdekében." });
      if (!canonical) issues.push({ severity: "info", category: "Meta", title: "Hiányzó canonical URL", description: "Nincs canonical link tag.", recommendation: "Add hozzá a canonical URL-t a duplikált tartalom elkerülése érdekében." });
      if (!langAttr) issues.push({ severity: "info", category: "Technikai", title: "Hiányzó lang attribútum", description: "A HTML tag nem tartalmaz lang attribútumot.", recommendation: "Add hozzá a lang attribútumot, pl. lang='hu'." });
      if (wordCount < 300) issues.push({ severity: "warning", category: "Tartalom", title: "Kevés szöveges tartalom", description: `Az oldal csak ~${wordCount} szót tartalmaz.`, recommendation: "Bővítsd a tartalmat legalább 500 szóra a jobb rangsorolás érdekében." });

      // PageSpeed-alapú issue-k
      if (pageSpeedMobile.performanceScore !== null && pageSpeedMobile.performanceScore < 50) {
        issues.push({ severity: "critical", category: "Sebesség (mobil)", title: `Lassú mobil betöltés (${pageSpeedMobile.performanceScore}/100)`,
          description: `A Google PageSpeed Insights mobil pontszáma alacsony. ${pageSpeedMobile.lcp ? `LCP: ${Math.round(pageSpeedMobile.lcp)}ms.` : ""}`,
          recommendation: "Optimalizáld a képeket (WebP/AVIF), minimalizáld a JS/CSS-t, használj CDN-t. A 2.5s alatti LCP a cél." });
      } else if (pageSpeedMobile.performanceScore !== null && pageSpeedMobile.performanceScore < 75) {
        issues.push({ severity: "warning", category: "Sebesség (mobil)", title: `Közepes mobil betöltés (${pageSpeedMobile.performanceScore}/100)`,
          description: "A mobil oldalsebesség javításra szorul.", recommendation: "Pontosabb javaslatok a PageSpeed Insights jelentésében." });
      }
      if (pageSpeedMobile.cls !== null && pageSpeedMobile.cls > 0.25) {
        issues.push({ severity: "warning", category: "Sebesség (mobil)", title: `Magas Layout Shift (CLS: ${pageSpeedMobile.cls.toFixed(3)})`,
          description: "Az oldal sokat ugrál betöltéskor.", recommendation: "Adj méreteket a képeknek/iframe-eknek, fix helyet a reklámoknak. A CLS < 0.1 a cél." });
      }

      // Broken links
      brokenLinks.forEach(bl => {
        issues.push({ severity: "warning", category: "Linkek", title: `Hibás ${bl.type === "internal" ? "belső" : "külső"} link`,
          description: `${bl.url} (${bl.status ?? "elérhetetlen"})`, recommendation: "Javítsd vagy távolítsd el a hibás linket." });
      });

      // ── 7. Pontszám: a PageSpeed-tel kombinálva ─────────────────────────
      const criticalCount = issues.filter(i => i.severity === "critical").length;
      const warningCount = issues.filter(i => i.severity === "warning").length;
      let baseScore = Math.max(0, Math.min(100, 100 - criticalCount * 15 - warningCount * 5));
      // Ha van PageSpeed adat, súlyozzuk: 60% on-page audit + 40% mobil performance
      let score = baseScore;
      if (pageSpeedMobile.performanceScore !== null) {
        score = Math.round(baseScore * 0.6 + pageSpeedMobile.performanceScore * 0.4);
      }

      // ── 8. AI insight + recommendation ──────────────────────────────────
      const auditSummary = [
        `URL: ${input.url}`,
        `Title: ${title ?? "N/A"} (${title?.length ?? 0} karakter)`,
        `Description: ${description ?? "N/A"} (${description?.length ?? 0} karakter)`,
        `H1: ${h1Texts[0] ?? "N/A"}`,
        `Wordcount: ${wordCount}`,
        `HTTPS: ${hasHttps}`,
        `Sitemap.xml: ${hasSitemap}, Robots.txt: ${hasRobotsTxt}`,
        `Strukturált adat: ${hasStructuredData}`,
        `PageSpeed mobil: ${pageSpeedMobile.performanceScore ?? "N/A"}/100, LCP ${pageSpeedMobile.lcp ? Math.round(pageSpeedMobile.lcp) + "ms" : "N/A"}, CLS ${pageSpeedMobile.cls?.toFixed(3) ?? "N/A"}`,
        `PageSpeed desktop: ${pageSpeedDesktop.performanceScore ?? "N/A"}/100, LCP ${pageSpeedDesktop.lcp ? Math.round(pageSpeedDesktop.lcp) + "ms" : "N/A"}`,
        `Belső linkek: ${internalLinks}, külső: ${externalLinks}, hibás linkek: ${brokenLinks.length}`,
        `Lekért aloldalak: ${crawlResults.length} (átlag szószám: ${crawlResults.length ? Math.round(crawlResults.reduce((s, p) => s + p.wordCount, 0) / crawlResults.length) : 0})`,
        `Problémák: ${issues.map(i => `[${i.severity}] ${i.title}`).join("; ")}`,
        `Score: ${score}/100`,
      ].join("\n");

      let aiInsights = "";
      let aiRecommendations = "";
      try {
        const aiResp = await invokeLLM({ messages: [
          { role: "system" as const, content: "Te egy SEO szakértő vagy. Elemezd a weboldal SEO audit eredményeit és adj részletes, szakmai értékelést magyarul. A PageSpeed adatokra (LCP, CLS, mobil score) külön térj ki, mert ezek a Google rangsorolásra is hatnak. Légy konkrét és cselekvésre ösztönző." },
          { role: "user" as const, content: `Elemezd ezt a SEO auditot és adj átfogó értékelést:\n\n${auditSummary}\n\nÍrj 3-4 bekezdéses elemzést a weboldal SEO állapotáról, erősségeiről és gyengeségeiről. Külön térj ki a mobil sebességre.` },
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
        performance: { loadTime: main.loadTime, pageSize: main.pageSize, hasHttps, hasSitemap, hasRobotsTxt },
        pageSpeed: { mobile: pageSpeedMobile, desktop: pageSpeedDesktop },
        content: { wordCount, internalLinks, externalLinks, imagesWithoutAlt, totalImages },
        technical: { hasStructuredData, hasViewport, hasCharset, hasFavicon, langAttribute: langAttr },
        crawledPages: crawlResults,
        brokenLinks,
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
