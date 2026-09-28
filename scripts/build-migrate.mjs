import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * Bundles the migration runner into dist/migrate.js, which `deploy.sh` runs
 * before the new containers start. Same reasoning as the worker build: the
 * production image has no `src/` and no TypeScript toolchain.
 */
await build({
  entryPoints: ["src/migrate.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  // ESM, because package.json declares `"type": "module"` (Payload 3's
  // adapters are ESM-only and its CLI loads the config outside Next). A CJS
  // bundle written to a .js file under that setting is parsed as ESM and
  // fails on `require`.
  format: "esm",
  outfile: "dist/migrate.js",
  sourcemap: true,
  /*
   * Some transitive CommonJS dependencies (ws, and others under Payload) call
   * `require()` at runtime. esbuild cannot express that in an ESM bundle, so
   * the bundle defines its own. Without this the runner dies on
   * `Dynamic require of "events" is not supported`.
   */
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  external: ["pg-native"],
  alias: {
    "@": fileURLToPath(new URL("../src", import.meta.url)),
    "@payload-config": fileURLToPath(
      new URL("../src/payload.config.ts", import.meta.url),
    ),
  },
  logLevel: "info",
});
