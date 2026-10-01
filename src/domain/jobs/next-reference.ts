import "server-only";

import { sql, type PostgresAdapter } from "@payloadcms/db-postgres";
import type { Payload } from "payload";

import { formatJobReference } from "./reference";

/**
 * The next `J-000042`, from the database sequence (see the second migration).
 * Checkout and the staff job form both take their numbers from here, so every
 * job in the register has one of the same kind.
 */
export async function nextJobReference(payload: Payload): Promise<string> {
  // Payload types `db` as its generic adapter; `payload.config.ts` configures
  // the Postgres one, which is what exposes Drizzle for raw SQL.
  const db = payload.db as unknown as PostgresAdapter;
  const result = await db.drizzle.execute<{ n: string }>(
    sql`select nextval('job_reference_seq') as n`,
  );

  return formatJobReference(Number(result.rows[0]?.n));
}
