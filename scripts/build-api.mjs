/**
 * G2A Growth Engine – Vercel API function bundler
 *
 * Bundles each api/**\/*.ts file into a self-contained .js using esbuild.
 * Output goes next to the source as .js — the .vercelignore excludes
 * the .ts files so Vercel deploys the bundled .js files instead.
 *
 * Why bundling?
 * - The Vercel @vercel/node builder does file-by-file compile (no bundle)
 *   when the project has "type": "module" in package.json.
 * - File-by-file compile keeps relative imports without ".js" extension,
 *   which Node.js ESM strict mode REJECTS at runtime
 *   (ERR_UNSUPPORTED_DIR_IMPORT, ERR_MODULE_NOT_FOUND).
 * - Path aliases like "@shared/*" don't resolve either.
 * - Bundling resolves EVERYTHING at build time: extensions, path aliases,
 *   directory imports — all flattened into one self-contained .js file.
 * - Result: runtime just loads one .js, no resolution surprises.
 *
 * NPM packages (express, @trpc/server, etc.) remain external because
 * Vercel's runtime already has them in /var/task/node_modules.
 */
import { build } from "esbuild";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function findApiTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...findApiTsFiles(path));
    } else if (
      path.endsWith(".ts") &&
      !path.endsWith(".d.ts") &&
      !path.endsWith(".test.ts")
    ) {
      out.push(path);
    }
  }
  return out;
}

const entries = findApiTsFiles("api");
console.log(`[build-api] Bundling ${entries.length} API function(s):`);
for (const entry of entries) console.log(`  - ${entry}`);

await Promise.all(
  entries.map((entry) => {
    const outfile = entry.replace(/\.ts$/, ".js");
    return build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: "node",
      target: "node20",
      format: "esm",
      // Keep NPM packages external — Vercel runtime provides them at /var/task/node_modules.
      // This bundles ONLY first-party code (server/, shared/, drizzle/).
      packages: "external",
      tsconfig: "api/tsconfig.json",
      // Banner adds Node.js ESM interop for CommonJS deps that use require()
      banner: {
        js: [
          "import { createRequire as __createRequire } from 'node:module';",
          "const require = __createRequire(import.meta.url);",
        ].join("\n"),
      },
      logLevel: "info",
      sourcemap: false,
      minify: false,
    }).then(() => console.log(`[build-api] ✓ ${entry} → ${outfile}`));
  }),
);

console.log("[build-api] Done.");
