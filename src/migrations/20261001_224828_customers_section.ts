import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * The Customers section (2 Oct 2026): office notes on a customer, email made
 * optional for customers the office records from a phone booking, and each
 * job linked to its customer so one person has one history however they
 * book. Additive: a column, a relationship, a relaxed NOT NULL, and a fill
 * of the new column.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "customers" ALTER COLUMN "email" DROP NOT NULL;
  ALTER TABLE "customers" ADD COLUMN "notes" varchar;
  ALTER TABLE "jobs" ADD COLUMN "customer_id" integer;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "jobs_customer_idx" ON "jobs" USING btree ("customer_id");

  -- Website jobs already made: their customer is the booking's. Fills an
  -- empty new column only; nothing existing is changed.
  UPDATE "jobs" SET "customer_id" = "bookings"."customer_id"
    FROM "bookings"
    WHERE "jobs"."booking_id" = "bookings"."id" AND "jobs"."customer_id" IS NULL;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" DROP CONSTRAINT "jobs_customer_id_customers_id_fk";
  
  DROP INDEX "jobs_customer_idx";
  ALTER TABLE "customers" ALTER COLUMN "email" SET NOT NULL;
  ALTER TABLE "customers" DROP COLUMN "notes";
  ALTER TABLE "jobs" DROP COLUMN "customer_id";`);
}
