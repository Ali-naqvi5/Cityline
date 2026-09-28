import { Pool } from "pg";

import { env } from "@/env";

/**
 * A small connection pool for health checks and the worker.
 *
 * Application data access goes through Payload (Drizzle) once the admin lands
 * in S8; both use the same `DATABASE_URL`. Reports that need raw SQL views
 * (§14) will use this pool too.
 */
let pool: Pool | undefined;

export function db(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

/** True when Postgres answers. Used by /api/health (NFR-02). */
export async function databaseReachable(): Promise<boolean> {
  try {
    await db().query("select 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
