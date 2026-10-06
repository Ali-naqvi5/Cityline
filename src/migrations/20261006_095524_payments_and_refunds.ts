import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_refunds_method" AS ENUM('stripe', 'bank_transfer', 'cash', 'other');
  CREATE TYPE "public"."enum_customer_payments_method" AS ENUM('card_link', 'bank_transfer', 'card', 'cash', 'other');
  CREATE TABLE "refunds_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"job_reference" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "customer_payments_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"job_reference" varchar,
  	"customer_name" varchar,
  	"pickup_at" timestamp(3) with time zone,
  	"route" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "customer_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"paid_at" timestamp(3) with time zone NOT NULL,
  	"method" "enum_customer_payments_method" NOT NULL,
  	"reference" varchar,
  	"paid_by" varchar,
  	"fee_pence" numeric,
  	"notes" varchar,
  	"amount_pence" numeric,
  	"recorded_by_id" integer,
  	"voided_at" timestamp(3) with time zone,
  	"void_reason" varchar,
  	"voided_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "refunds" ALTER COLUMN "payment_id" DROP NOT NULL;
  ALTER TABLE "refunds" ALTER COLUMN "stripe_refund_id" DROP NOT NULL;
  ALTER TABLE "jobs" ADD COLUMN "customer_payment_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "customer_paid_price_pence" numeric;
  ALTER TABLE "payments" ADD COLUMN "fee_recorded_at" timestamp(3) with time zone;
  ALTER TABLE "payments" ADD COLUMN "stripe_charge_id" varchar;
  ALTER TABLE "refunds" ADD COLUMN "customer_payment_id" integer;
  ALTER TABLE "refunds" ADD COLUMN "refunded_at" timestamp(3) with time zone;
  ALTER TABLE "refunds" ADD COLUMN "method" "enum_refunds_method";
  ALTER TABLE "refunds" ADD COLUMN "reference" varchar;
  ALTER TABLE "refunds" ADD COLUMN "voided_at" timestamp(3) with time zone;
  ALTER TABLE "refunds" ADD COLUMN "void_reason" varchar;
  ALTER TABLE "refunds" ADD COLUMN "voided_by_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customer_payments_id" integer;
  ALTER TABLE "refunds_lines" ADD CONSTRAINT "refunds_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds_lines" ADD CONSTRAINT "refunds_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."refunds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_payments_lines" ADD CONSTRAINT "customer_payments_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_payments_lines" ADD CONSTRAINT "customer_payments_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customer_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "refunds_lines_order_idx" ON "refunds_lines" USING btree ("_order");
  CREATE INDEX "refunds_lines_parent_id_idx" ON "refunds_lines" USING btree ("_parent_id");
  CREATE INDEX "refunds_lines_job_idx" ON "refunds_lines" USING btree ("job_id");
  CREATE INDEX "customer_payments_lines_order_idx" ON "customer_payments_lines" USING btree ("_order");
  CREATE INDEX "customer_payments_lines_parent_id_idx" ON "customer_payments_lines" USING btree ("_parent_id");
  CREATE INDEX "customer_payments_lines_job_idx" ON "customer_payments_lines" USING btree ("job_id");
  CREATE INDEX "customer_payments_paid_at_idx" ON "customer_payments" USING btree ("paid_at");
  CREATE INDEX "customer_payments_recorded_by_idx" ON "customer_payments" USING btree ("recorded_by_id");
  CREATE INDEX "customer_payments_voided_by_idx" ON "customer_payments" USING btree ("voided_by_id");
  CREATE INDEX "customer_payments_updated_at_idx" ON "customer_payments" USING btree ("updated_at");
  CREATE INDEX "customer_payments_created_at_idx" ON "customer_payments" USING btree ("created_at");
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_payment_id_customer_payments_id_fk" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_customer_payment_id_customer_payments_id_fk" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customer_payments_fk" FOREIGN KEY ("customer_payments_id") REFERENCES "public"."customer_payments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_customer_payment_idx" ON "jobs" USING btree ("customer_payment_id");
  CREATE INDEX "refunds_customer_payment_idx" ON "refunds" USING btree ("customer_payment_id");
  CREATE INDEX "refunds_refunded_at_idx" ON "refunds" USING btree ("refunded_at");
  CREATE INDEX "refunds_voided_by_idx" ON "refunds" USING btree ("voided_by_id");
  CREATE INDEX "payload_locked_documents_rels_customer_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("customer_payments_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "refunds_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_payments_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customer_payments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "refunds_lines" CASCADE;
  DROP TABLE "customer_payments_lines" CASCADE;
  DROP TABLE "customer_payments" CASCADE;
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_customer_payment_id_customer_payments_id_fk";
  
  ALTER TABLE "refunds" DROP CONSTRAINT "refunds_customer_payment_id_customer_payments_id_fk";
  
  ALTER TABLE "refunds" DROP CONSTRAINT "refunds_voided_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customer_payments_fk";
  
  DROP INDEX "jobs_customer_payment_idx";
  DROP INDEX "refunds_customer_payment_idx";
  DROP INDEX "refunds_refunded_at_idx";
  DROP INDEX "refunds_voided_by_idx";
  DROP INDEX "payload_locked_documents_rels_customer_payments_id_idx";
  ALTER TABLE "refunds" ALTER COLUMN "payment_id" SET NOT NULL;
  ALTER TABLE "refunds" ALTER COLUMN "stripe_refund_id" SET NOT NULL;
  ALTER TABLE "jobs" DROP COLUMN "customer_payment_id";
  ALTER TABLE "jobs" DROP COLUMN "customer_paid_price_pence";
  ALTER TABLE "payments" DROP COLUMN "fee_recorded_at";
  ALTER TABLE "payments" DROP COLUMN "stripe_charge_id";
  ALTER TABLE "refunds" DROP COLUMN "customer_payment_id";
  ALTER TABLE "refunds" DROP COLUMN "refunded_at";
  ALTER TABLE "refunds" DROP COLUMN "method";
  ALTER TABLE "refunds" DROP COLUMN "reference";
  ALTER TABLE "refunds" DROP COLUMN "voided_at";
  ALTER TABLE "refunds" DROP COLUMN "void_reason";
  ALTER TABLE "refunds" DROP COLUMN "voided_by_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customer_payments_id";
  DROP TYPE "public"."enum_refunds_method";
  DROP TYPE "public"."enum_customer_payments_method";`);
}
