import config from "@payload-config";
import { getPayload } from "payload";

/**
 * Runs pending migrations, then exits. Bundled to `dist/migrate.js` and called
 * by `deploy.sh` after the pre-deploy dump and before the new containers start
 * (PRD-05).
 *
 * A separate entry point rather than the `payload` CLI, for the same reason the
 * worker is one: the production image ships Next's standalone output, which has
 * no `src/`, no TypeScript and no CLI. Bundling the config and the migrations
 * into one file means the thing that runs on the server is the thing that was
 * built and tested.
 *
 * Only ever migrates up. A rollback is redeploying the previous image, not
 * undoing the schema — DATA-04 says a removal takes two deployments.
 */
async function main(): Promise<void> {
  const payload = await getPayload({ config });

  await payload.db.migrate();

  // getPayload holds a pool open; without this the container never exits and
  // `docker compose run` hangs the deploy.
  await payload.db.destroy?.();
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
