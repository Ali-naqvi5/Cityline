import { closeDb } from "@/lib/db";

import { runWorkerTick } from "./index";

/**
 * Entry point for the `worker` container (`node dist/worker.js`).
 * Ticks every 60 seconds, and exits cleanly on SIGTERM so `docker compose up -d`
 * can replace it without losing an in-flight tick.
 *
 * Run once locally with: pnpm worker
 */
const INTERVAL_MS = 60_000;
const once = process.argv.includes("--once");

let stopping = false;

async function tick(): Promise<void> {
  const result = await runWorkerTick();
  const line = JSON.stringify({ source: "worker", ...result });
  if (result.ok) console.log(line);
  else console.error(line);
}

async function main(): Promise<void> {
  await tick();
  if (once) {
    await closeDb();
    return;
  }

  while (!stopping) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    if (stopping) break;
    await tick();
  }

  await closeDb();
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ source: "worker", fatal: String(error) }));
  process.exitCode = 1;
});
