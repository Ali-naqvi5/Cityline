import { fileURLToPath } from "node:url";

import { build } from "esbuild";

/**
 * Bundles the worker entry into dist/worker.js, which is what the `worker`
 * container runs (§12). Bundling (rather than shipping TypeScript) keeps the
 * worker independent of the Next build output.
 */
await build({
  entryPoints: ["src/worker/run.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/worker.js",
  sourcemap: true,
  // `pg` loads optional native bindings at runtime; keep it external.
  external: ["pg-native"],
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  logLevel: "info",
});
