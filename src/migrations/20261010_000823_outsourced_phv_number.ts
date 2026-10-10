import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * An outsourced driver's optional PHV licence number (Cityline, 10 Oct
 * 2026): one column added; nothing removed.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "phv_licence_number" varchar;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "drivers" DROP COLUMN "phv_licence_number";`);
}
