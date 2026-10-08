import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_drivers_engagement" AS ENUM('registered', 'outsourced');
  ALTER TABLE "drivers" ADD COLUMN "engagement" "enum_drivers_engagement" DEFAULT 'registered' NOT NULL;
  CREATE INDEX "drivers_engagement_idx" ON "drivers" USING btree ("engagement");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "drivers_engagement_idx";
  ALTER TABLE "drivers" DROP COLUMN "engagement";
  DROP TYPE "public"."enum_drivers_engagement";`);
}
