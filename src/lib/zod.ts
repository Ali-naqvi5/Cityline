import { z } from "zod";

/**
 * Zod, configured once. Import `z` from here, never from "zod" (ESLint
 * enforces it).
 *
 * `jitless`: Zod speeds up object schemas by compiling them with
 * `new Function`, after first probing whether `eval` is allowed. The booking
 * pages' Content Security Policy forbids `eval` (src/lib/csp.ts), so the probe
 * fails and Zod falls back to plain parsing — correct, but the browser logs a
 * CSP violation for every visit. Turning the compiler off skips the probe, and
 * our schemas are far too small for it to have mattered.
 */
z.config({ jitless: true });

export { z };
