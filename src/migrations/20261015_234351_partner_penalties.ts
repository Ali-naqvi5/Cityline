import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "driver_payments_penalties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"penalty_id" integer NOT NULL,
  	"penalty_reference" varchar,
  	"job_reference" varchar,
  	"penalised_at" timestamp(3) with time zone,
  	"reason" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "supplier_payments_penalties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"penalty_id" integer NOT NULL,
  	"penalty_reference" varchar,
  	"job_reference" varchar,
  	"supplier_reference" varchar,
  	"penalised_at" timestamp(3) with time zone,
  	"reason" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "supplier_invoices_penalties" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"penalty_id" integer NOT NULL,
  	"penalty_reference" varchar,
  	"job_reference" varchar,
  	"supplier_reference" varchar,
  	"penalised_at" timestamp(3) with time zone,
  	"reason" varchar,
  	"amount_pence" numeric
  );
  
  CREATE TABLE "partner_penalties" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"supplier_id" integer,
  	"job_id" integer NOT NULL,
  	"job_reference" varchar,
  	"supplier_reference" varchar,
  	"penalised_at" timestamp(3) with time zone NOT NULL,
  	"amount_pence" numeric NOT NULL,
  	"reason" varchar NOT NULL,
  	"partner_reference" varchar,
  	"driver_share_pence" numeric DEFAULT 0,
  	"driver_id" integer,
  	"operator_id" integer,
  	"supplier_payment_id" integer,
  	"supplier_invoice_id" integer,
  	"driver_payment_id" integer,
  	"recorded_by_id" integer,
  	"voided_at" timestamp(3) with time zone,
  	"void_reason" varchar,
  	"voided_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "driver_payments" ADD COLUMN "penalties_pence" numeric;
  ALTER TABLE "supplier_payments" ADD COLUMN "bookings_pence" numeric;
  ALTER TABLE "supplier_payments" ADD COLUMN "penalties_pence" numeric;
  ALTER TABLE "supplier_invoices" ADD COLUMN "bookings_pence" numeric;
  ALTER TABLE "supplier_invoices" ADD COLUMN "penalties_pence" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "partner_penalties_id" integer;
  ALTER TABLE "driver_payments_penalties" ADD CONSTRAINT "driver_payments_penalties_penalty_id_partner_penalties_id_fk" FOREIGN KEY ("penalty_id") REFERENCES "public"."partner_penalties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_payments_penalties" ADD CONSTRAINT "driver_payments_penalties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."driver_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "supplier_payments_penalties" ADD CONSTRAINT "supplier_payments_penalties_penalty_id_partner_penalties_id_fk" FOREIGN KEY ("penalty_id") REFERENCES "public"."partner_penalties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_payments_penalties" ADD CONSTRAINT "supplier_payments_penalties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."supplier_payments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "supplier_invoices_penalties" ADD CONSTRAINT "supplier_invoices_penalties_penalty_id_partner_penalties_id_fk" FOREIGN KEY ("penalty_id") REFERENCES "public"."partner_penalties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_invoices_penalties" ADD CONSTRAINT "supplier_invoices_penalties_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_supplier_payment_id_supplier_payments_id_fk" FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_driver_payment_id_driver_payments_id_fk" FOREIGN KEY ("driver_payment_id") REFERENCES "public"."driver_payments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_penalties" ADD CONSTRAINT "partner_penalties_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "driver_payments_penalties_order_idx" ON "driver_payments_penalties" USING btree ("_order");
  CREATE INDEX "driver_payments_penalties_parent_id_idx" ON "driver_payments_penalties" USING btree ("_parent_id");
  CREATE INDEX "driver_payments_penalties_penalty_idx" ON "driver_payments_penalties" USING btree ("penalty_id");
  CREATE INDEX "supplier_payments_penalties_order_idx" ON "supplier_payments_penalties" USING btree ("_order");
  CREATE INDEX "supplier_payments_penalties_parent_id_idx" ON "supplier_payments_penalties" USING btree ("_parent_id");
  CREATE INDEX "supplier_payments_penalties_penalty_idx" ON "supplier_payments_penalties" USING btree ("penalty_id");
  CREATE INDEX "supplier_invoices_penalties_order_idx" ON "supplier_invoices_penalties" USING btree ("_order");
  CREATE INDEX "supplier_invoices_penalties_parent_id_idx" ON "supplier_invoices_penalties" USING btree ("_parent_id");
  CREATE INDEX "supplier_invoices_penalties_penalty_idx" ON "supplier_invoices_penalties" USING btree ("penalty_id");
  CREATE INDEX "partner_penalties_supplier_idx" ON "partner_penalties" USING btree ("supplier_id");
  CREATE INDEX "partner_penalties_job_idx" ON "partner_penalties" USING btree ("job_id");
  CREATE INDEX "partner_penalties_penalised_at_idx" ON "partner_penalties" USING btree ("penalised_at");
  CREATE INDEX "partner_penalties_driver_idx" ON "partner_penalties" USING btree ("driver_id");
  CREATE INDEX "partner_penalties_operator_idx" ON "partner_penalties" USING btree ("operator_id");
  CREATE INDEX "partner_penalties_supplier_payment_idx" ON "partner_penalties" USING btree ("supplier_payment_id");
  CREATE INDEX "partner_penalties_supplier_invoice_idx" ON "partner_penalties" USING btree ("supplier_invoice_id");
  CREATE INDEX "partner_penalties_driver_payment_idx" ON "partner_penalties" USING btree ("driver_payment_id");
  CREATE INDEX "partner_penalties_recorded_by_idx" ON "partner_penalties" USING btree ("recorded_by_id");
  CREATE INDEX "partner_penalties_voided_by_idx" ON "partner_penalties" USING btree ("voided_by_id");
  CREATE INDEX "partner_penalties_updated_at_idx" ON "partner_penalties" USING btree ("updated_at");
  CREATE INDEX "partner_penalties_created_at_idx" ON "partner_penalties" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partner_penalties_fk" FOREIGN KEY ("partner_penalties_id") REFERENCES "public"."partner_penalties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_partner_penalties_id_idx" ON "payload_locked_documents_rels" USING btree ("partner_penalties_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "driver_payments_penalties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_payments_penalties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "supplier_invoices_penalties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partner_penalties" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "driver_payments_penalties" CASCADE;
  DROP TABLE "supplier_payments_penalties" CASCADE;
  DROP TABLE "supplier_invoices_penalties" CASCADE;
  DROP TABLE "partner_penalties" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_partner_penalties_fk";
  
  DROP INDEX "payload_locked_documents_rels_partner_penalties_id_idx";
  ALTER TABLE "driver_payments" DROP COLUMN "penalties_pence";
  ALTER TABLE "supplier_payments" DROP COLUMN "bookings_pence";
  ALTER TABLE "supplier_payments" DROP COLUMN "penalties_pence";
  ALTER TABLE "supplier_invoices" DROP COLUMN "bookings_pence";
  ALTER TABLE "supplier_invoices" DROP COLUMN "penalties_pence";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "partner_penalties_id";`);
}
