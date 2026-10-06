import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Supplier Money (6 Oct 2026): money received from partners and invoices to
 * them, each with the bookings it covers as they were then; on each booking
 * the receipt and invoice that cover it, and for a cancelled partner booking
 * whether the partner still pays; a billing address on each partner.
 * Additive: four new tables, new columns.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_jobs_cancellation_charge" AS ENUM('charged', 'not_charged');
  CREATE TYPE "public"."enum_supplier_payments_method" AS ENUM('bank_transfer', 'card', 'other');
  CREATE TABLE "supplier_payments_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"job_reference" varchar,
  	"supplier_reference" varchar,
  	"pickup_at" timestamp(3) with time zone,
  	"route" varchar,
  	"status" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "supplier_payments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"supplier_id" integer NOT NULL,
  	"received_at" timestamp(3) with time zone NOT NULL,
  	"method" "enum_supplier_payments_method" NOT NULL,
  	"reference" varchar,
  	"notes" varchar,
  	"amount_pence" numeric,
  	"recorded_by_id" integer,
  	"voided_at" timestamp(3) with time zone,
  	"void_reason" varchar,
  	"voided_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "supplier_invoices_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"job_id" integer NOT NULL,
  	"job_reference" varchar,
  	"supplier_reference" varchar,
  	"pickup_at" timestamp(3) with time zone,
  	"route" varchar,
  	"status" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "supplier_invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"supplier_id" integer NOT NULL,
  	"issued_at" timestamp(3) with time zone NOT NULL,
  	"due_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"total_pence" numeric,
  	"sent_at" timestamp(3) with time zone,
  	"created_by_id" integer,
  	"voided_at" timestamp(3) with time zone,
  	"void_reason" varchar,
  	"voided_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "jobs" ADD COLUMN "supplier_payment_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "supplier_invoice_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "cancellation_charge" "enum_jobs_cancellation_charge";
  ALTER TABLE "suppliers" ADD COLUMN "billing_address" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "supplier_payments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "supplier_invoices_id" integer;
  ALTER TABLE "supplier_payments_lines" ADD CONSTRAINT "supplier_payments_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_payments_lines" ADD CONSTRAINT "supplier_payments_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."supplier_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_invoices_lines" ADD CONSTRAINT "supplier_invoices_lines_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_invoices_lines" ADD CONSTRAINT "supplier_invoices_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "supplier_payments_lines_order_idx" ON "supplier_payments_lines" USING btree ("_order");
  CREATE INDEX "supplier_payments_lines_parent_id_idx" ON "supplier_payments_lines" USING btree ("_parent_id");
  CREATE INDEX "supplier_payments_lines_job_idx" ON "supplier_payments_lines" USING btree ("job_id");
  CREATE INDEX "supplier_payments_supplier_idx" ON "supplier_payments" USING btree ("supplier_id");
  CREATE INDEX "supplier_payments_received_at_idx" ON "supplier_payments" USING btree ("received_at");
  CREATE INDEX "supplier_payments_recorded_by_idx" ON "supplier_payments" USING btree ("recorded_by_id");
  CREATE INDEX "supplier_payments_voided_by_idx" ON "supplier_payments" USING btree ("voided_by_id");
  CREATE INDEX "supplier_payments_updated_at_idx" ON "supplier_payments" USING btree ("updated_at");
  CREATE INDEX "supplier_payments_created_at_idx" ON "supplier_payments" USING btree ("created_at");
  CREATE INDEX "supplier_invoices_lines_order_idx" ON "supplier_invoices_lines" USING btree ("_order");
  CREATE INDEX "supplier_invoices_lines_parent_id_idx" ON "supplier_invoices_lines" USING btree ("_parent_id");
  CREATE INDEX "supplier_invoices_lines_job_idx" ON "supplier_invoices_lines" USING btree ("job_id");
  CREATE INDEX "supplier_invoices_supplier_idx" ON "supplier_invoices" USING btree ("supplier_id");
  CREATE INDEX "supplier_invoices_issued_at_idx" ON "supplier_invoices" USING btree ("issued_at");
  CREATE INDEX "supplier_invoices_created_by_idx" ON "supplier_invoices" USING btree ("created_by_id");
  CREATE INDEX "supplier_invoices_voided_by_idx" ON "supplier_invoices" USING btree ("voided_by_id");
  CREATE INDEX "supplier_invoices_updated_at_idx" ON "supplier_invoices" USING btree ("updated_at");
  CREATE INDEX "supplier_invoices_created_at_idx" ON "supplier_invoices" USING btree ("created_at");
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_supplier_payment_id_supplier_payments_id_fk" FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_supplier_payments_fk" FOREIGN KEY ("supplier_payments_id") REFERENCES "public"."supplier_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_supplier_invoices_fk" FOREIGN KEY ("supplier_invoices_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_supplier_payment_idx" ON "jobs" USING btree ("supplier_payment_id");
  CREATE INDEX "jobs_supplier_invoice_idx" ON "jobs" USING btree ("supplier_invoice_id");
  CREATE INDEX "payload_locked_documents_rels_supplier_payments_id_idx" ON "payload_locked_documents_rels" USING btree ("supplier_payments_id");
  CREATE INDEX "payload_locked_documents_rels_supplier_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("supplier_invoices_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "supplier_payments_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_invoices_lines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_invoices" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "supplier_payments_lines" CASCADE;
  DROP TABLE "supplier_payments" CASCADE;
  DROP TABLE "supplier_invoices_lines" CASCADE;
  DROP TABLE "supplier_invoices" CASCADE;
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_supplier_payment_id_supplier_payments_id_fk";
  
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_supplier_invoice_id_supplier_invoices_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_supplier_payments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_supplier_invoices_fk";
  
  DROP INDEX "jobs_supplier_payment_idx";
  DROP INDEX "jobs_supplier_invoice_idx";
  DROP INDEX "payload_locked_documents_rels_supplier_payments_id_idx";
  DROP INDEX "payload_locked_documents_rels_supplier_invoices_id_idx";
  ALTER TABLE "jobs" DROP COLUMN "supplier_payment_id";
  ALTER TABLE "jobs" DROP COLUMN "supplier_invoice_id";
  ALTER TABLE "jobs" DROP COLUMN "cancellation_charge";
  ALTER TABLE "suppliers" DROP COLUMN "billing_address";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "supplier_payments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "supplier_invoices_id";
  DROP TYPE "public"."enum_jobs_cancellation_charge";
  DROP TYPE "public"."enum_supplier_payments_method";`);
}
