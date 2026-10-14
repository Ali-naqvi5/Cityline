import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

/**
 * Driver payments record the period they cover (Cityline, 14 Oct 2026): from
 * the day after the driver's last payment to the day they run up to. Adds the
 * column, then fills it in for the payments already made, by the same rule
 * the collection now applies to new ones (`paymentPeriodStart`):
 *
 *   - the day after the latest earlier "up to" of the driver's payments that
 *     are not voided; a first payment, its first booking's day;
 *   - never later than its first booking, nor its own "up to".
 *
 * The rule is written out here rather than imported, so this migration stays
 * as it ran. Only the new column is written.
 */

const LONDON = "Europe/London";

/** The London day of an instant, "YYYY-MM-DD". */
function londonDay(value: Date | string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Noon, London time, on a day — how Driver Pay stores its days. */
function londonNoon(day: string): string {
  const guess = new Date(`${day}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    timeZoneName: "shortOffset",
  })
    .formatToParts(guess)
    .find((part) => part.type === "timeZoneName")!
    .value.replace("GMT", "");
  const hours = offset ? Number(offset.split(":")[0]) : 0;
  return new Date(guess.getTime() - hours * 3_600_000).toISOString();
}

interface PaymentRow {
  id: number;
  driver_id: number;
  up_to: string;
  voided: boolean;
  first_pickup: string | null;
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "driver_payments" ADD COLUMN "period_from" timestamp(3) with time zone;`);

  const { rows } = await db.execute(sql`
    SELECT p.id, p.driver_id, p.up_to, (p.voided_at IS NOT NULL) AS voided,
           min(l.pickup_at) AS first_pickup
    FROM driver_payments p
    LEFT JOIN driver_payments_lines l ON l._parent_id = p.id
    GROUP BY p.id`);
  const payments = (rows as unknown as PaymentRow[]).map((row) => ({
    ...row,
    upTo: londonDay(row.up_to),
  }));

  for (const payment of payments) {
    const previous = payments
      .filter(
        (other) =>
          other.driver_id === payment.driver_id &&
          !other.voided &&
          other.upTo < payment.upTo,
      )
      .map((other) => other.upTo)
      .sort()
      .at(-1);
    const firstBooking = payment.first_pickup
      ? londonDay(payment.first_pickup)
      : payment.upTo;
    const from = [
      previous ? addDays(previous, 1) : firstBooking,
      firstBooking,
      payment.upTo,
    ].sort()[0]!;
    await db.execute(sql`
      UPDATE "driver_payments" SET "period_from" = ${londonNoon(from)} WHERE "id" = ${payment.id};`);
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "driver_payments" DROP COLUMN "period_from";`);
}
