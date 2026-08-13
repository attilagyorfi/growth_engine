/**
 * G2A Growth Engine – Report PDF renderer (STUB)
 *
 * A `reports.generate` mutation ezt hívja meg a summary + AI-narratíva után.
 * A production impl a Playwright-tal fog HTML→PDF konvertálni:
 *
 *   TODO (későbbi PR, ha a Playwright-ot bevesszük):
 *   1. `pnpm add -D playwright && npx playwright install chromium`
 *   2. Belső token-védett route: `/api/reports/:id/render` → HTML page a
 *      report.summaryData-jából (Recharts + brand-frame)
 *   3. `chromium.launch()` → `page.goto(...)` → `page.pdf({ format: 'A4' })`
 *   4. Vercel Blob-ra upload → visszaadja a publikus URL-t
 *   5. `updateReport(id, { pdfUrl: url })`
 *
 * JELENLEG: nem generál valódi PDF-et — placeholder URL-t ad vissza. A
 * frontend a `summaryData`-ból tud renderelni preview-t Recharts-tal;
 * a PDF download gombja a preview-t nyomtatható CSS-sel exportálja
 * (window.print()) amíg a Playwright bekötése meg nem történik.
 */

export async function renderReportPdf(params: {
  reportId: string;
}): Promise<string> {
  // Fejlesztési stub — a UI a summaryData-ból preview-t renderel.
  // A `pdfUrl` egy placeholder amit a preview oldal ignore-ol,
  // de kompatibilis a router.generate return-jével.
  const stubUrl = `/api/reports/${params.reportId}/render`;
  console.warn(
    `[reports/pdf] renderReportPdf STUB — Playwright dep nincs bekötve. Report ${params.reportId} pdfUrl: ${stubUrl}`,
  );
  return stubUrl;
}
