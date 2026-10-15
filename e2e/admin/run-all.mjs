/**
 * Runs the admin checks in order against the local dev server and database.
 *
 *   pnpm e2e:admin                    every suite
 *   pnpm e2e:admin dispatch payments  just those
 *
 * The order matters: `fleet` and `dispatch` set up the drivers, cars and
 * bookings the later suites use.
 */
import { spawnSync } from "node:child_process";

const ORDER = [
  "fleet",
  "outsourced",
  "dispatch",
  "assign",
  "fleet-merge",
  "driver-report",
  "customers",
  "driver-pay",
  "driver-pay-period",
  "operators",
  "expenses",
  "finance-report",
  "job-form",
  "job-type",
  "payments",
  "report",
  "run-sheet",
  "supplier-money",
  "access-filters-classes",
  "owner-rules",
];

const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !ORDER.includes(name));
if (unknown.length) {
  console.error(`Unknown suite: ${unknown.join(", ")}. Suites: ${ORDER.join(", ")}`);
  process.exit(2);
}
const suites = wanted.length ? ORDER.filter((name) => wanted.includes(name)) : ORDER;

console.log(
  "Admin checks: the dev server must be running with emails off (NUNTLY_API_KEY= pnpm dev).\n",
);

const results = [];
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const run = spawnSync(
    process.execPath,
    ["--env-file=.env.local", `e2e/admin/${suite}.check.mjs`],
    { stdio: "inherit" },
  );
  results.push({ suite, ok: run.status === 0 });
  // The guard refused: nothing else will run either.
  if (run.status === 2) break;
}

console.log("\n=== Summary ===");
for (const { suite, ok } of results) console.log(`${ok ? "PASS" : "FAIL"}  ${suite}`);
const failed = results.filter((result) => !result.ok).length;
process.exit(failed || results.length < suites.length ? 1 : 0);
