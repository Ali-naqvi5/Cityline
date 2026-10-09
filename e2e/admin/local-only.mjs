/**
 * Every admin check imports this first. The checks sign in as local test
 * staff and create, change and delete records, so they must only ever run
 * against the local database and dev server, never the live site.
 */
import { mkdirSync } from "node:fs";

function refuse(message) {
  console.error(`\nAdmin checks not run: ${message}\n`);
  process.exit(2);
}

let host = "";
try {
  host = new URL(process.env.DATABASE_URL ?? "").hostname;
} catch {
  host = "";
}
if (!["localhost", "127.0.0.1"].includes(host)) {
  refuse(
    "DATABASE_URL is not the local database. Run from the project folder with --env-file=.env.local.",
  );
}
if (!process.env.ADMIN_TEST_PASSWORD) {
  refuse(
    "ADMIN_TEST_PASSWORD is not set. Add the local test staff password to .env.local (see e2e/admin/README.md).",
  );
}

// Screenshots go here; the folder is ignored by git.
mkdirSync("test-results/admin", { recursive: true });
