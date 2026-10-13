import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "driver_payments" ADD COLUMN "receipt_id" integer;
  ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_receipt_id_private_files_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."private_files"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "driver_payments_receipt_idx" ON "driver_payments" USING btree ("receipt_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "driver_payments" DROP CONSTRAINT "driver_payments_receipt_id_private_files_id_fk";
  
  DROP INDEX "driver_payments_receipt_idx";
  ALTER TABLE "driver_payments" DROP COLUMN "receipt_id";`);
}
