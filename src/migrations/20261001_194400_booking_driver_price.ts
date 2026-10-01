import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * What the driver is paid, written on each booking (Cityline, 2 Oct 2026).
 *
 * The same decision removed driver pay rules, employment type and supplier
 * commission from the system. Their columns — drivers.employment_type,
 * pay_rule, pay_fixed_pence, pay_percent_bp, show_pay_in_messages,
 * suppliers.default_commission_bp, jobs.commission_bp and commission_pence —
 * were created by 20260930_221901 and are already in production, so they are
 * left in place, unused, rather than dropped: migrations here only add. Each
 * has a default or allows null, so writes that no longer mention them work.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" ADD COLUMN "driver_price_pence" numeric;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "jobs" DROP COLUMN "driver_price_pence";`);
}
