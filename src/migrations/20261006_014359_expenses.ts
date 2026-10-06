import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Expenses (6 Oct 2026): Cityline's own costs, entered by hand one by one.
 * Additive: one new table.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_expenses_method" AS ENUM('card', 'bank_transfer', 'cash', 'other');
  CREATE TABLE "expenses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"spent_at" timestamp(3) with time zone NOT NULL,
  	"description" varchar NOT NULL,
  	"amount_pence" numeric NOT NULL,
  	"paid_to" varchar,
  	"method" "enum_expenses_method",
  	"receipt_id" integer,
  	"notes" varchar,
  	"recorded_by_id" integer,
  	"voided_at" timestamp(3) with time zone,
  	"void_reason" varchar,
  	"voided_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "expenses_id" integer;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_id_private_files_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."private_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "expenses_spent_at_idx" ON "expenses" USING btree ("spent_at");
  CREATE INDEX "expenses_receipt_idx" ON "expenses" USING btree ("receipt_id");
  CREATE INDEX "expenses_recorded_by_idx" ON "expenses" USING btree ("recorded_by_id");
  CREATE INDEX "expenses_voided_by_idx" ON "expenses" USING btree ("voided_by_id");
  CREATE INDEX "expenses_updated_at_idx" ON "expenses" USING btree ("updated_at");
  CREATE INDEX "expenses_created_at_idx" ON "expenses" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk" FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("expenses_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "expenses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "expenses" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_expenses_fk";
  
  DROP INDEX "payload_locked_documents_rels_expenses_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "expenses_id";
  DROP TYPE "public"."enum_expenses_method";`);
}
