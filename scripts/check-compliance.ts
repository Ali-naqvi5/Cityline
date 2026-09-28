import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import { findForbiddenWords } from "../src/domain/compliance/forbidden-words";
import { findUnsupportedClaims } from "../src/domain/compliance/unsupported-claims";

/**
 * CMP-01 / SEO-11 guard, run in CI.
 *
 * A TfL private hire operator may not advertise using "taxi" or "cab". This
 * scans everything that produces customer-facing output. The same check found
 * seven `local_taxi` Material Symbols icons in the supplied designs, which
 * render an actual taxi glyph.
 *
 * If a match is legitimate, reword it — do not widen the allowlist without
 * recording a reason here.
 */
const ALLOWLIST = new Set([
  // These define and test the rules, so they necessarily contain the words
  // and the phrasings being banned.
  "src/domain/compliance/forbidden-words.ts",
  "src/domain/compliance/forbidden-words.test.ts",
  "src/domain/compliance/unsupported-claims.ts",
  "src/domain/compliance/unsupported-claims.test.ts",
]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const files = sourceFiles("src").filter(
  (file) => !ALLOWLIST.has(file.split(sep).join("/")),
);

let failures = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const where = file.split(sep).join("/");

  for (const hit of findForbiddenWords(source)) {
    failures += 1;
    console.error(`${where}: forbidden wording "${hit.word}" at offset ${hit.index}`);
  }

  // Flight tracking will never be built (Cityline, 22 Sep 2026). The supplied
  // designs promise it on several pages that are still to be ported, so this
  // stops the copy arriving with them.
  for (const hit of findUnsupportedClaims(source)) {
    failures += 1;
    console.error(`${where}: claims a capability we do not have [${hit.id}]`);
    console.error(`    "${hit.sentence}"`);
    console.error(`    ${hit.instead}`);
  }
}

if (failures > 0) {
  console.error("");
  console.error(
    `${failures} problem(s). Forbidden wording is a TfL licence condition ` +
      `(CMP-01) — use "transfer", "private hire" or "chauffeur". Unsupported ` +
      `claims are capabilities Cityline does not have and will not build.`,
  );
  process.exit(1);
}

console.log(
  `Compliance check passed: ${files.length} files, no forbidden wording ` +
    `and no unsupported claims.`,
);
