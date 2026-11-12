# A PDF-riport betűi

- `DejaVuSans.ttf`, `DejaVuSans-Bold.ttf` — DejaVu Sans 2.37 (normál + félkövér), a
  [dejavu-fonts](https://github.com/dejavu-fonts/dejavu-fonts) kiadásából, a riporthoz
  szükséges tartományokra szűkítve (latin, görög, cirill, írásjelek, pénznem, nyilak,
  néhány szimbólum). Licenc: `LICENSE-DejaVu.txt` (Bitstream Vera / Arev, a DejaVu-
  módosítások közkincsek).
- `embedded.ts` — GENERÁLT: a két TTF base64-ben, hogy a betű a buildelt kódba
  (Railway: `dist/index.js`, Vercel: `api/*.js`) fájlútvonal nélkül bekerüljön.

A szűkítés (fontTools):

```
pyftsubset DejaVuSans.ttf --unicodes="U+0020-007E,U+00A0-024F,U+0370-03FF,U+0400-04FF,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2212,U+2264,U+2265,U+2260,U+221E,U+25A0-25FF,U+2713,U+2714,U+2717,U+FFFD" --layout-features='kern,liga' --no-hinting --name-IDs='*' --name-languages='*' --output-file=DejaVuSans.ttf
```

TTF-csere után: `node scripts/gen-report-fonts.mjs` (a `server/reports-pdf.test.ts`
ellenőrzi, hogy az `embedded.ts` egyezik a TTF-ekkel).
