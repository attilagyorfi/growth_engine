/**
 * G2A Growth Engine – a PDF-riport betűinek beágyazása (G1)
 *
 * A server/reports/fonts/*.ttf fájlokból (DejaVu Sans normál + félkövér,
 * Latin/görög/cirill tartományra szűkítve, licenc: LICENSE-DejaVu.txt)
 * generálja a server/reports/fonts/embedded.ts modult (base64). Így a betű a
 * kód része: az esbuild-bundle (Railway: dist/index.js, Vercel: api/*.js) és
 * a vitest is fájlrendszer-útvonal nélkül éri el.
 *
 * Futtatás a TTF cseréje után:  node scripts/gen-report-fonts.mjs
 * (a server/reports-pdf.test.ts ellenőrzi, hogy a modul és a TTF egyezik).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join("server", "reports", "fonts");
const fonts = { regular: "DejaVuSans.ttf", bold: "DejaVuSans-Bold.ttf" };

const lines = [
  "// GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: server/reports/fonts/*.ttf,",
  "// újragenerálás: node scripts/gen-report-fonts.mjs. Licenc: LICENSE-DejaVu.txt.",
  "",
];
for (const [key, file] of Object.entries(fonts)) {
  const b64 = readFileSync(join(dir, file)).toString("base64");
  lines.push(`/** ${file} (base64) */`);
  lines.push(`export const ${key === "regular" ? "DEJAVU_SANS_REGULAR_BASE64" : "DEJAVU_SANS_BOLD_BASE64"} =`);
  lines.push(`  "${b64}";`);
  lines.push("");
}
writeFileSync(join(dir, "embedded.ts"), lines.join("\n"));
console.log("[gen-report-fonts] server/reports/fonts/embedded.ts kész");
