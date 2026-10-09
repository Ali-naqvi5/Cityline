import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Green Class for cars (Cityline, 10 Oct 2026): one value added to the class
 * list. The retired 16 seat minibus stays, as the database is never shrunk.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_vehicles_vehicle_class_slug" ADD VALUE IF NOT EXISTS 'green';`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "vehicles" ALTER COLUMN "vehicle_class_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_vehicles_vehicle_class_slug";
  CREATE TYPE "public"."enum_vehicles_vehicle_class_slug" AS ENUM('saloon', 'estate', 'executive', 'mpv-5', 'mpv-8', 'minibus-16');
  ALTER TABLE "vehicles" ALTER COLUMN "vehicle_class_slug" SET DATA TYPE "public"."enum_vehicles_vehicle_class_slug" USING "vehicle_class_slug"::"public"."enum_vehicles_vehicle_class_slug";`);
}
