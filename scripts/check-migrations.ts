import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

/**
 * DATA-04: migrations only add.
 *
 * Removing or renaming a column takes two deployments — add and copy first,
 * drop later, once nothing reads the old one. A migration that drops a column
 * in the same release that stops using it will take the data with it, and the
 * nightly backup is a worse answer than not doing it.
 *
 * Only the `up` path is checked. `down` exists for local development and is
 * never run by `deploy.sh`; a rollback in production is redeploying the
 * previous image, not undoing the schema.
 */
const DESTRUCTIVE = [
  { pattern: /\bDROP\s+TABLE\b/i, what: "DROP TABLE" },
  { pattern: /\bDROP\s+COLUMN\b/i, what: "DROP COLUMN" },
  { pattern: /\bTRUNCATE\b/i, what: "TRUNCATE" },
  { pattern: /\bDELETE\s+FROM\b/i, what: "DELETE FROM" },
  { pattern: /\bDROP\s+SCHEMA\b/i, what: "DROP SCHEMA" },
  { pattern: /\bDROP\s+DATABASE\b/i, what: "DROP DATABASE" },
  // Renaming loses the old name just as surely as dropping it.
  { pattern: /\bRENAME\s+COLUMN\b/i, what: "RENAME COLUMN" },
  // Dropping a list type takes its columns with it under CASCADE, and is what
  // Payload writes when an option is removed from a select field.
  { pattern: /\bDROP\s+TYPE\b/i, what: "DROP TYPE" },
  // The job reference numbers come from a sequence; dropping it restarts them.
  { pattern: /\bDROP\s+SEQUENCE\b/i, what: "DROP SEQUENCE" },
  { pattern: /\bDROP\s+VIEW\b/i, what: "DROP VIEW" },
  // Any DROP … CASCADE removes whatever depends on the thing dropped.
  { pattern: /\bDROP\b[^;]*\bCASCADE\b/i, what: "DROP … CASCADE" },
];

const MIGRATION_DIR = "src/migrations";

let failures = 0;

const files = readdirSync(MIGRATION_DIR).filter(
  (name) => /\.ts$/.test(name) && name !== "index.ts",
);

for (const name of files) {
  const path = join(MIGRATION_DIR, name);
  const source = readFileSync(path, "utf8");

  // Everything between `export async function up` and `export async function
  // down`. If there is no down, the whole remainder is the up path.
  const upStart = source.indexOf("export async function up");
  if (upStart === -1) continue;
  const downStart = source.indexOf("export async function down");
  const up = source.slice(upStart, downStart === -1 ? undefined : downStart);

  for (const { pattern, what } of DESTRUCTIVE) {
    if (!pattern.test(up)) continue;
    failures += 1;
    console.error(`${MIGRATION_DIR.split(sep).join("/")}/${name}: ${what} in up()`);
  }
}

if (failures > 0) {
  console.error("");
  console.error(
    `${failures} destructive statement(s) in a migration's up path. ` +
      `Migrations only add (DATA-04): add and copy in one deployment, drop in ` +
      `a later one, once nothing reads the old column.`,
  );
  process.exit(1);
}

console.log(`Migration check passed: ${files.length} migration(s), all additive.`);
