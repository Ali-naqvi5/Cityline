import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * TfL driver records and drivers taken off bookings (5 Oct 2026): the
 * National Insurance number, why a driver left and whether TfL must be told
 * (form PHV/105), and on a job's history the driver taken off and the reason
 * written for it. Additive: new columns, a relationship, and a fill of the
 * new relationship for history written before it existed.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "job_events" ADD COLUMN "driver_taken_off_id" integer;
  ALTER TABLE "job_events" ADD COLUMN "note" varchar;
  ALTER TABLE "drivers" ADD COLUMN "national_insurance_number" varchar;
  ALTER TABLE "drivers" ADD COLUMN "left_reason" varchar;
  ALTER TABLE "drivers" ADD COLUMN "left_for_conduct" boolean DEFAULT false;
  ALTER TABLE "drivers" ADD COLUMN "tfl_told_at" timestamp(3) with time zone;
  ALTER TABLE "job_events" ADD CONSTRAINT "job_events_driver_taken_off_id_drivers_id_fk" FOREIGN KEY ("driver_taken_off_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "job_events_driver_taken_off_idx" ON "job_events" USING btree ("driver_taken_off_id");

  -- Earlier history named the driver taken off only as "Name · REG". Link
  -- the row to that driver where the name belongs to exactly one driver;
  -- fills the empty new column only, nothing existing is changed.
  UPDATE "job_events" SET "driver_taken_off_id" = "drivers"."id"
    FROM "drivers"
    WHERE "job_events"."type" IN ('unassigned', 'assigned')
      AND "job_events"."field" = 'driver'
      AND "job_events"."old_value" IS NOT NULL
      AND "job_events"."driver_taken_off_id" IS NULL
      AND "drivers"."full_name" = split_part("job_events"."old_value", ' · ', 1)
      AND (SELECT count(*) FROM "drivers" AS "same"
             WHERE "same"."full_name" = "drivers"."full_name") = 1;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "job_events" DROP CONSTRAINT "job_events_driver_taken_off_id_drivers_id_fk";
  
  DROP INDEX "job_events_driver_taken_off_idx";
  ALTER TABLE "job_events" DROP COLUMN "driver_taken_off_id";
  ALTER TABLE "job_events" DROP COLUMN "note";
  ALTER TABLE "drivers" DROP COLUMN "national_insurance_number";
  ALTER TABLE "drivers" DROP COLUMN "left_reason";
  ALTER TABLE "drivers" DROP COLUMN "left_for_conduct";
  ALTER TABLE "drivers" DROP COLUMN "tfl_told_at";`);
}
