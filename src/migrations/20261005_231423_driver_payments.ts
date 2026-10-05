import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Driver Pay (6 Oct 2026): payments to drivers, each with the bookings it
 * covers as they were when paid, and on each booking the payment that covers
 * it and the driver price it was paid at. Additive: two new tables and two new
 * columns on jobs.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_driver_payments_method" AS ENUM('bank_transfer', 'cash', 'other');
  CREATE TABLE "driver_payments_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"job_reference" varchar,
  	"pickup_at" timestamp(3) with time zone,
  	"route" varchar,
  	"status" varchar,
  	"price_pence" numeric,
  	"cash_pence" numeric
  );
  
  CREATE TABLE "driver_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"driver_id" integer NOT NULL,
  	"up_to" timestamp(3) with time zone NOT NULL,
  	"paid_at" timestamp(3) with time zone NOT NULL,
  	"method" "enum_driver_payments_method" NOT NULL,
  	"reference" varchar,
  	"notes" varchar,
  	"earned_pence" numeric,
  	"cash_pence" numeric,
  	"amount_pence" numeric,
  	"recorded_by_id" integer,
  	"voided_at" timestamp(3) with time zone,
  	"void_reason" varchar,
  	"voided_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "jobs" ADD COLUMN "driver_payment_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "driver_paid_price_pence" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "driver_payments_id" integer;
  ALTER TABLE "driver_payments_lines" ADD CONSTRAINT "driver_payments_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_payments_lines" ADD CONSTRAINT "driver_payments_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."driver_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "driver_payments_lines_order_idx" ON "driver_payments_lines" USING btree ("_order");
  CREATE INDEX "driver_payments_lines_parent_id_idx" ON "driver_payments_lines" USING btree ("_parent_id");
  CREATE INDEX "driver_payments_lines_job_idx" ON "driver_payments_lines" USING btree ("job_id");
  CREATE INDEX "driver_payments_driver_idx" ON "driver_payments" USING btree ("driver_id");
  CREATE INDEX "driver_payments_paid_at_idx" ON "driver_payments" USING btree ("paid_at");
  CREATE INDEX "driver_payments_recorded_by_idx" ON "driver_payments" USING btree ("recorded_by_id");
  CREATE INDEX "driver_payments_voided_by_idx" ON "driver_payments" USING btree ("voided_by_id");
  CREATE INDEX "driver_payments_updated_at_idx" ON "driver_payments" USING btree ("updated_at");
  CREATE INDEX "driver_payments_created_at_idx" ON "driver_payments" USING btree ("created_at");
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_driver_payment_id_driver_payments_id_fk" FOREIGN KEY ("driver_payment_id") REFERENCES "public"."driver_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_driver_payments_fk" FOREIGN KEY ("driver_payments_id") REFERENCES "public"."driver_payments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_driver_payment_idx" ON "jobs" USING btree ("driver_payment_id");
  CREATE INDEX "payload_locked_documents_rels_driver_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("driver_payments_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "driver_payments_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "driver_payments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "driver_payments_lines" CASCADE;
  DROP TABLE "driver_payments" CASCADE;
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_driver_payment_id_driver_payments_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_driver_payments_fk";
  
  DROP INDEX "jobs_driver_payment_idx";
  DROP INDEX "payload_locked_documents_rels_driver_payments_id_idx";
  ALTER TABLE "jobs" DROP COLUMN "driver_payment_id";
  ALTER TABLE "jobs" DROP COLUMN "driver_paid_price_pence";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "driver_payments_id";
  DROP TYPE "public"."enum_driver_payments_method";`);
}
