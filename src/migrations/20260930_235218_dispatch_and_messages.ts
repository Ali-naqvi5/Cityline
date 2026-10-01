import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_jobs_driver_message_status" AS ENUM('not_sent', 'sent', 'delivered', 'read', 'failed');
  CREATE TYPE "public"."enum_jobs_passenger_message_status" AS ENUM('not_sent', 'sent', 'failed');
  ALTER TABLE "jobs" ADD COLUMN "booker_name" varchar;
  ALTER TABLE "jobs" ADD COLUMN "booker_phone" varchar;
  ALTER TABLE "jobs" ADD COLUMN "booker_email" varchar;
  ALTER TABLE "jobs" ADD COLUMN "driver_confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "no_show_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "driver_message_status" "enum_jobs_driver_message_status" DEFAULT 'not_sent' NOT NULL;
  ALTER TABLE "jobs" ADD COLUMN "driver_message_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "passenger_message_status" "enum_jobs_passenger_message_status" DEFAULT 'not_sent' NOT NULL;
  ALTER TABLE "jobs" ADD COLUMN "passenger_message_at" timestamp(3) with time zone;

  -- JOB-03, per leg: a supplier's round trip is often one reference for both
  -- journeys, so the reference is unique per supplier *and leg*. No leg counts
  -- as outbound. Looser than the index it replaces, so no existing row can
  -- break it; created before the old one is dropped.
  CREATE UNIQUE INDEX "jobs_supplier_id_reference_leg_unique"
    ON "jobs" ("supplier_id", "supplier_reference", (COALESCE("leg", 'outbound')))
    WHERE "supplier_id" IS NOT NULL AND "supplier_reference" IS NOT NULL;
  DROP INDEX IF EXISTS "jobs_supplier_id_reference_unique";`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS "jobs_supplier_id_reference_unique"
    ON "jobs" ("supplier_id", "supplier_reference")
    WHERE "supplier_id" IS NOT NULL AND "supplier_reference" IS NOT NULL;
  DROP INDEX IF EXISTS "jobs_supplier_id_reference_leg_unique";
   ALTER TABLE "jobs" DROP COLUMN "booker_name";
  ALTER TABLE "jobs" DROP COLUMN "booker_phone";
  ALTER TABLE "jobs" DROP COLUMN "booker_email";
  ALTER TABLE "jobs" DROP COLUMN "driver_confirmed_at";
  ALTER TABLE "jobs" DROP COLUMN "no_show_at";
  ALTER TABLE "jobs" DROP COLUMN "driver_message_status";
  ALTER TABLE "jobs" DROP COLUMN "driver_message_at";
  ALTER TABLE "jobs" DROP COLUMN "passenger_message_status";
  ALTER TABLE "jobs" DROP COLUMN "passenger_message_at";
  DROP TYPE "public"."enum_jobs_driver_message_status";
  DROP TYPE "public"."enum_jobs_passenger_message_status";`);
}
