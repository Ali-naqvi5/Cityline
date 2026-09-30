import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_drivers_status" AS ENUM('active', 'suspended', 'left');
  CREATE TYPE "public"."enum_drivers_employment_type" AS ENUM('self_employed', 'employee');
  CREATE TYPE "public"."enum_drivers_pay_rule" AS ENUM('fixed', 'percent', 'rate_card');
  CREATE TYPE "public"."enum_drivers_show_pay_in_messages" AS ENUM('default', 'show', 'hide');
  CREATE TYPE "public"."enum_driver_documents_type" AS ENUM('phv_licence', 'dvla_licence', 'dbs', 'right_to_work', 'other');
  CREATE TYPE "public"."enum_vehicles_vehicle_class_slug" AS ENUM('saloon', 'estate', 'executive', 'mpv-5', 'mpv-8', 'minibus-16');
  CREATE TYPE "public"."enum_vehicles_ownership" AS ENUM('company', 'driver', 'hired');
  CREATE TYPE "public"."enum_vehicles_status" AS ENUM('active', 'off_road', 'sold');
  CREATE TYPE "public"."enum_vehicle_documents_type" AS ENUM('phv_vehicle_licence', 'mot', 'insurance', 'v5c', 'service');
  CREATE TYPE "public"."enum_private_files_purpose" AS ENUM('driver_document', 'vehicle_document', 'driver_photo', 'receipt', 'other');
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('create', 'update', 'delete');
  CREATE TABLE "drivers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"full_name" varchar,
  	"phone" varchar NOT NULL,
  	"email" varchar,
  	"address" varchar,
  	"date_of_birth" timestamp(3) with time zone,
  	"photo_id" integer,
  	"status" "enum_drivers_status" DEFAULT 'active' NOT NULL,
  	"employment_type" "enum_drivers_employment_type" DEFAULT 'self_employed' NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"pay_rule" "enum_drivers_pay_rule" DEFAULT 'fixed' NOT NULL,
  	"pay_fixed_pence" numeric,
  	"pay_percent_bp" numeric,
  	"show_pay_in_messages" "enum_drivers_show_pay_in_messages" DEFAULT 'default' NOT NULL,
  	"whatsapp_consent_at" timestamp(3) with time zone,
  	"bank_details_sealed" varchar,
  	"bank_account_last4" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "driver_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"driver_id" integer NOT NULL,
  	"type" "enum_driver_documents_type" NOT NULL,
  	"number" varchar,
  	"issued_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"file_id" integer,
  	"verified_by_id" integer,
  	"verified_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vehicles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"registration" varchar NOT NULL,
  	"make" varchar NOT NULL,
  	"model" varchar NOT NULL,
  	"colour" varchar NOT NULL,
  	"vehicle_class_slug" "enum_vehicles_vehicle_class_slug" NOT NULL,
  	"seats" numeric,
  	"ownership" "enum_vehicles_ownership" DEFAULT 'driver' NOT NULL,
  	"status" "enum_vehicles_status" DEFAULT 'active' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vehicles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"drivers_id" integer
  );
  
  CREATE TABLE "vehicle_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vehicle_id" integer NOT NULL,
  	"type" "enum_vehicle_documents_type" NOT NULL,
  	"number" varchar,
  	"issued_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"file_id" integer,
  	"verified_by_id" integer,
  	"verified_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "suppliers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"default_commission_bp" numeric DEFAULT 0 NOT NULL,
  	"payment_terms_days" numeric DEFAULT 30,
  	"contact_name" varchar,
  	"email" varchar,
  	"phone" varchar,
  	"dashboard_url" varchar,
  	"notes" varchar,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "private_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"purpose" "enum_private_files_purpose" DEFAULT 'other' NOT NULL,
  	"uploaded_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"entity" varchar NOT NULL,
  	"doc_id" varchar NOT NULL,
  	"doc_label" varchar,
  	"action" "enum_audit_log_action" NOT NULL,
  	"changes" jsonb,
  	"user_id" integer,
  	"role" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "jobs" ADD COLUMN "supplier_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "supplier_reference" varchar;
  ALTER TABLE "jobs" ADD COLUMN "driver_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "vehicle_id" integer;
  ALTER TABLE "jobs" ADD COLUMN "commission_bp" numeric;
  ALTER TABLE "jobs" ADD COLUMN "commission_pence" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drivers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "driver_documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vehicles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vehicle_documents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "suppliers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "private_files_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "drivers" ADD CONSTRAINT "drivers_photo_id_private_files_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."private_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_file_id_private_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."private_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles_rels" ADD CONSTRAINT "vehicles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_rels" ADD CONSTRAINT "vehicles_rels_drivers_fk" FOREIGN KEY ("drivers_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_file_id_private_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."private_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "private_files" ADD CONSTRAINT "private_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "drivers_full_name_idx" ON "drivers" USING btree ("full_name");
  CREATE UNIQUE INDEX "drivers_phone_idx" ON "drivers" USING btree ("phone");
  CREATE INDEX "drivers_photo_idx" ON "drivers" USING btree ("photo_id");
  CREATE INDEX "drivers_status_idx" ON "drivers" USING btree ("status");
  CREATE INDEX "drivers_updated_at_idx" ON "drivers" USING btree ("updated_at");
  CREATE INDEX "drivers_created_at_idx" ON "drivers" USING btree ("created_at");
  CREATE INDEX "driver_documents_driver_idx" ON "driver_documents" USING btree ("driver_id");
  CREATE INDEX "driver_documents_type_idx" ON "driver_documents" USING btree ("type");
  CREATE INDEX "driver_documents_expires_at_idx" ON "driver_documents" USING btree ("expires_at");
  CREATE INDEX "driver_documents_file_idx" ON "driver_documents" USING btree ("file_id");
  CREATE INDEX "driver_documents_verified_by_idx" ON "driver_documents" USING btree ("verified_by_id");
  CREATE INDEX "driver_documents_updated_at_idx" ON "driver_documents" USING btree ("updated_at");
  CREATE INDEX "driver_documents_created_at_idx" ON "driver_documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "vehicles_registration_idx" ON "vehicles" USING btree ("registration");
  CREATE INDEX "vehicles_vehicle_class_slug_idx" ON "vehicles" USING btree ("vehicle_class_slug");
  CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");
  CREATE INDEX "vehicles_updated_at_idx" ON "vehicles" USING btree ("updated_at");
  CREATE INDEX "vehicles_created_at_idx" ON "vehicles" USING btree ("created_at");
  CREATE INDEX "vehicles_rels_order_idx" ON "vehicles_rels" USING btree ("order");
  CREATE INDEX "vehicles_rels_parent_idx" ON "vehicles_rels" USING btree ("parent_id");
  CREATE INDEX "vehicles_rels_path_idx" ON "vehicles_rels" USING btree ("path");
  CREATE INDEX "vehicles_rels_drivers_id_idx" ON "vehicles_rels" USING btree ("drivers_id");
  CREATE INDEX "vehicle_documents_vehicle_idx" ON "vehicle_documents" USING btree ("vehicle_id");
  CREATE INDEX "vehicle_documents_type_idx" ON "vehicle_documents" USING btree ("type");
  CREATE INDEX "vehicle_documents_expires_at_idx" ON "vehicle_documents" USING btree ("expires_at");
  CREATE INDEX "vehicle_documents_file_idx" ON "vehicle_documents" USING btree ("file_id");
  CREATE INDEX "vehicle_documents_verified_by_idx" ON "vehicle_documents" USING btree ("verified_by_id");
  CREATE INDEX "vehicle_documents_updated_at_idx" ON "vehicle_documents" USING btree ("updated_at");
  CREATE INDEX "vehicle_documents_created_at_idx" ON "vehicle_documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");
  CREATE INDEX "suppliers_active_idx" ON "suppliers" USING btree ("active");
  CREATE INDEX "suppliers_updated_at_idx" ON "suppliers" USING btree ("updated_at");
  CREATE INDEX "suppliers_created_at_idx" ON "suppliers" USING btree ("created_at");
  CREATE INDEX "private_files_uploaded_by_idx" ON "private_files" USING btree ("uploaded_by_id");
  CREATE INDEX "private_files_updated_at_idx" ON "private_files" USING btree ("updated_at");
  CREATE INDEX "private_files_created_at_idx" ON "private_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "private_files_filename_idx" ON "private_files" USING btree ("filename");
  CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity");
  CREATE INDEX "audit_log_doc_id_idx" ON "audit_log" USING btree ("doc_id");
  CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drivers_fk" FOREIGN KEY ("drivers_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_driver_documents_fk" FOREIGN KEY ("driver_documents_id") REFERENCES "public"."driver_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicle_documents_fk" FOREIGN KEY ("vehicle_documents_id") REFERENCES "public"."vehicle_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suppliers_fk" FOREIGN KEY ("suppliers_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_private_files_fk" FOREIGN KEY ("private_files_id") REFERENCES "public"."private_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "jobs_supplier_idx" ON "jobs" USING btree ("supplier_id");
  CREATE INDEX "jobs_supplier_reference_idx" ON "jobs" USING btree ("supplier_reference");
  CREATE INDEX "jobs_driver_idx" ON "jobs" USING btree ("driver_id");
  CREATE INDEX "jobs_vehicle_idx" ON "jobs" USING btree ("vehicle_id");
  CREATE INDEX "payload_locked_documents_rels_drivers_id_idx" ON "payload_locked_documents_rels" USING btree ("drivers_id");
  CREATE INDEX "payload_locked_documents_rels_driver_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("driver_documents_id");
  CREATE INDEX "payload_locked_documents_rels_vehicles_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicles_id");
  CREATE INDEX "payload_locked_documents_rels_vehicle_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicle_documents_id");
  CREATE INDEX "payload_locked_documents_rels_suppliers_id_idx" ON "payload_locked_documents_rels" USING btree ("suppliers_id");
  CREATE INDEX "payload_locked_documents_rels_private_files_id_idx" ON "payload_locked_documents_rels" USING btree ("private_files_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  -- JOB-03: the same supplier booking cannot be entered twice. Partial, so
  -- jobs without a supplier (website, phone) are unaffected. The Jobs hook
  -- checks first so staff are told which job already has the reference.
  CREATE UNIQUE INDEX "jobs_supplier_id_reference_unique"
    ON "jobs" ("supplier_id", "supplier_reference")
    WHERE "supplier_id" IS NOT NULL AND "supplier_reference" IS NOT NULL;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "jobs_supplier_id_reference_unique";
   ALTER TABLE "drivers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "driver_documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vehicles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vehicles_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vehicle_documents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "suppliers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "private_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "drivers" CASCADE;
  DROP TABLE "driver_documents" CASCADE;
  DROP TABLE "vehicles" CASCADE;
  DROP TABLE "vehicles_rels" CASCADE;
  DROP TABLE "vehicle_documents" CASCADE;
  DROP TABLE "suppliers" CASCADE;
  DROP TABLE "private_files" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_supplier_id_suppliers_id_fk";
  
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_driver_id_drivers_id_fk";
  
  ALTER TABLE "jobs" DROP CONSTRAINT "jobs_vehicle_id_vehicles_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drivers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_driver_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vehicles_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vehicle_documents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_suppliers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_private_files_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  DROP INDEX "jobs_supplier_idx";
  DROP INDEX "jobs_supplier_reference_idx";
  DROP INDEX "jobs_driver_idx";
  DROP INDEX "jobs_vehicle_idx";
  DROP INDEX "payload_locked_documents_rels_drivers_id_idx";
  DROP INDEX "payload_locked_documents_rels_driver_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_vehicles_id_idx";
  DROP INDEX "payload_locked_documents_rels_vehicle_documents_id_idx";
  DROP INDEX "payload_locked_documents_rels_suppliers_id_idx";
  DROP INDEX "payload_locked_documents_rels_private_files_id_idx";
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  ALTER TABLE "jobs" DROP COLUMN "supplier_id";
  ALTER TABLE "jobs" DROP COLUMN "supplier_reference";
  ALTER TABLE "jobs" DROP COLUMN "driver_id";
  ALTER TABLE "jobs" DROP COLUMN "vehicle_id";
  ALTER TABLE "jobs" DROP COLUMN "commission_bp";
  ALTER TABLE "jobs" DROP COLUMN "commission_pence";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drivers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "driver_documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vehicles_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vehicle_documents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "suppliers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "private_files_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  DROP TYPE "public"."enum_drivers_status";
  DROP TYPE "public"."enum_drivers_employment_type";
  DROP TYPE "public"."enum_drivers_pay_rule";
  DROP TYPE "public"."enum_drivers_show_pay_in_messages";
  DROP TYPE "public"."enum_driver_documents_type";
  DROP TYPE "public"."enum_vehicles_vehicle_class_slug";
  DROP TYPE "public"."enum_vehicles_ownership";
  DROP TYPE "public"."enum_vehicles_status";
  DROP TYPE "public"."enum_vehicle_documents_type";
  DROP TYPE "public"."enum_private_files_purpose";
  DROP TYPE "public"."enum_audit_log_action";`);
}
