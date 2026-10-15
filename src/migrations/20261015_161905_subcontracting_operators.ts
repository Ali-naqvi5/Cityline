import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_operators_licensed_from" AS ENUM('tfl', 'council', 'scotland');
  ALTER TYPE "public"."enum_private_files_purpose" ADD VALUE IF NOT EXISTS 'operator_licence' BEFORE 'other';
  CREATE TABLE "operators" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"legal_name" varchar,
  	"licensed_from" "enum_operators_licensed_from" DEFAULT 'tfl' NOT NULL,
  	"licensing_authority" varchar,
  	"licence_number" varchar,
  	"licence_expires_at" timestamp(3) with time zone,
  	"licence_copy_id" integer,
  	"operating_centre" varchar,
  	"contact_name" varchar,
  	"phone" varchar NOT NULL,
  	"email" varchar,
  	"whatsapp_consent_at" timestamp(3) with time zone,
  	"date_joined" timestamp(3) with time zone,
  	"date_left" timestamp(3) with time zone,
  	"company_number" varchar,
  	"vat_number" varchar,
  	"bank_details_sealed" varchar,
  	"bank_account_last4" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "driver_payments" ALTER COLUMN "driver_id" DROP NOT NULL;
  ALTER TABLE "jobs" ADD COLUMN "operator_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "subcontractor_licence_no" varchar;
  ALTER TABLE "jobs" ADD COLUMN "subcontractor_licensed_from" varchar;
  ALTER TABLE "driver_payments" ADD COLUMN "operator_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "operators_id" integer;
  ALTER TABLE "operators" ADD CONSTRAINT "operators_licence_copy_id_private_files_id_fk" FOREIGN KEY ("licence_copy_id") REFERENCES "public"."private_files"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "operators_name_idx" ON "operators" USING btree ("name");
  CREATE INDEX "operators_licence_copy_idx" ON "operators" USING btree ("licence_copy_id");
  CREATE INDEX "operators_updated_at_idx" ON "operators" USING btree ("updated_at");
  CREATE INDEX "operators_created_at_idx" ON "operators" USING btree ("created_at");
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_operators_fk" FOREIGN KEY ("operators_id") REFERENCES "public"."operators"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_operator_idx" ON "jobs" USING btree ("operator_id");
  CREATE INDEX "driver_payments_operator_idx" ON "driver_payments" USING btree ("operator_id");
  CREATE INDEX "payload_locked_documents_rels_operators_id_idx" ON "payload_locked_documents_rels" USING btree ("operators_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "operators" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "operators" CASCADE;
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_operator_id_operators_id_fk";
  
  ALTER TABLE "driver_payments" DROP CONSTRAINT "driver_payments_operator_id_operators_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_operators_fk";
  
  ALTER TABLE "private_files" ALTER COLUMN "purpose" SET DATA TYPE text;
  ALTER TABLE "private_files" ALTER COLUMN "purpose" SET DEFAULT 'other'::text;
  DROP TYPE "public"."enum_private_files_purpose";
  CREATE TYPE "public"."enum_private_files_purpose" AS ENUM('driver_document', 'vehicle_document', 'driver_photo', 'receipt', 'other');
  ALTER TABLE "private_files" ALTER COLUMN "purpose" SET DEFAULT 'other'::"public"."enum_private_files_purpose";
  ALTER TABLE "private_files" ALTER COLUMN "purpose" SET DATA TYPE "public"."enum_private_files_purpose" USING "purpose"::"public"."enum_private_files_purpose";
  DROP INDEX "jobs_operator_idx";
  DROP INDEX "driver_payments_operator_idx";
  DROP INDEX "payload_locked_documents_rels_operators_id_idx";
  ALTER TABLE "driver_payments" ALTER COLUMN "driver_id" SET NOT NULL;
  ALTER TABLE "jobs" DROP COLUMN "operator_id";
  ALTER TABLE "jobs" DROP COLUMN "subcontractor_licence_no";
  ALTER TABLE "jobs" DROP COLUMN "subcontractor_licensed_from";
  ALTER TABLE "driver_payments" DROP COLUMN "operator_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "operators_id";
  DROP TYPE "public"."enum_operators_licensed_from";`);
}
