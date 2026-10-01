import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Cityline's operating cycle (2 Oct 2026): DOW, DAP and POB stages between
 * "driver confirmed" and "completed", each with the time it was reached.
 * Adds enum values and columns only. PostgreSQL 12+ allows ADD VALUE inside
 * the migration's transaction; nothing here uses the new values, so it is
 * safe there.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_jobs_status" ADD VALUE 'on_the_way' BEFORE 'completed';
  ALTER TYPE "public"."enum_jobs_status" ADD VALUE 'at_pickup' BEFORE 'completed';
  ALTER TYPE "public"."enum_jobs_status" ADD VALUE 'on_board' BEFORE 'completed';
  ALTER TABLE "jobs" ADD COLUMN "on_the_way_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "at_pickup_at" timestamp(3) with time zone;
  ALTER TABLE "jobs" ADD COLUMN "on_board_at" timestamp(3) with time zone;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'unassigned'::text;
  DROP TYPE "public"."enum_jobs_status";
  CREATE TYPE "public"."enum_jobs_status" AS ENUM('unassigned', 'assigned', 'driver_confirmed', 'completed', 'no_show', 'cancelled');
  ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'unassigned'::"public"."enum_jobs_status";
  ALTER TABLE "jobs" ALTER COLUMN "status" SET DATA TYPE "public"."enum_jobs_status" USING "status"::"public"."enum_jobs_status";
  ALTER TABLE "jobs" DROP COLUMN "on_the_way_at";
  ALTER TABLE "jobs" DROP COLUMN "at_pickup_at";
  ALTER TABLE "jobs" DROP COLUMN "on_board_at";`);
}
