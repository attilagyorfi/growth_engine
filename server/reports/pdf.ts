/**
 * G2A Growth Engine – Report PDF renderer (server-side placeholder)
 *
 * JELENLEGI PDF-MEGOLDÁS (élő): a frontend a riport-előnézetet nyomtatás-
 * optimalizált CSS-sel exportálja — a „PDF letöltése" gomb window.print()-et
 * hív, és a böngésző „Mentés PDF-ként" valódi PDF-et ad, tökéletes magyar
 * ékezettel és a valós diagramokkal. (Reports.tsx #report-print-area + a
 * @media print szabályok az index.css-ben.) Nulla szerver-oldali függőség.
 *
 * Ez a függvény egy szerver-oldalon GENERÁLT .pdf FÁJL helye — ez akkor kell
 * majd, ha az automatikus, EMAILBEN küldött havi riportok (reportSchedules)
 * élesednek (a mellékletet nem lehet böngésző-nyomtatással előállítani).
 * Terv: pdf-lib + beágyazott Unicode betűkészlet (dejavu) → Vercel Blob upload.
 * Addig placeholder URL-t ad, amit a frontend figyelmen kívül hagy.
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
