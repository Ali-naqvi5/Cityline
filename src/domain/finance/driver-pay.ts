import type { JobStatus } from "@/domain/jobs/labels";
import { DISPLAY_TIMEZONE } from "@/lib/time";

import { driverSharesTotal, type PenaltyLine } from "./penalties";

/**
 * Driver pay (approved by Cityline, 6 Oct 2026): what each driver is owed,
 * built from the driver price written on each booking.
 *
 *   - A booking is paid once its work is done — completed, or a passenger
 *     no-show (PNS), at whatever price is written, a reduced one included —
 *     and only once a price has been written.
 *   - Cash a passenger paid the driver is Cityline's money in the driver's
 *     hands, so it comes off what the driver is owed. Only a completed
 *     booking has cash: at a PNS nobody paid.
 *   - Pay runs up to any date the office chooses; each payment records the
 *     bookings it covers, so none can be paid twice.
 *   - Each payment covers a period: from the day after the driver's last
 *     payment to the day it runs up to (Cityline, 14 Oct 2026).
 *   - A partner penalty's share passed to the driver comes off their next
 *     payment, whichever bookings it covers (Cityline, 16 Oct 2026).
 *
 * Drivers are independent: this is payment for bookings, never wages.
 */

export interface PayJob {
  id: number;
  reference: string;
  status: JobStatus;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  hours: number | null;
  driverPricePence: number | null;
  paymentMethod: string;
  customerPricePence: number | null;
  /** The payment to the driver that covers this booking, once there is one. */
  driverPaymentId: number | null;
  /** The driver price when it was paid, to notice a later change. */
  driverPaidPricePence: number | null;
}

export function isWorkDone(job: Pick<PayJob, "status">): boolean {
  return job.status === "completed" || job.status === "no_show";
}

/** Cash the passenger handed the driver for this booking. */
export function cashHeldPence(
  job: Pick<PayJob, "status" | "paymentMethod" | "customerPricePence">,
): number {
  return job.status === "completed" && job.paymentMethod === "cash"
    ? (job.customerPricePence ?? 0)
    : 0;
}

/** Done, priced and not yet paid. */
export function isPayable(job: PayJob): boolean {
  return isWorkDone(job) && job.driverPricePence !== null && job.driverPaymentId === null;
}

/** Paid, but the driver price has changed since: a difference to settle. */
export function priceChangedSincePaid(job: PayJob): boolean {
  return (
    job.driverPaymentId !== null &&
    job.driverPaidPricePence !== null &&
    job.driverPricePence !== job.driverPaidPricePence
  );
}

export function routeText(
  job: Pick<PayJob, "pickupAddress" | "dropoffAddress" | "hours">,
): string {
  return `${job.pickupAddress} to ${
    job.dropoffAddress ?? (job.hours ? `hourly hire, ${job.hours} hours` : "as directed")
  }`;
}

export interface PayTotals {
  /** The driver prices of the bookings. */
  earnedPence: number;
  /** Cash the driver already holds. */
  cashPence: number;
  /** The driver's share of partner penalties, taken off. */
  penaltiesPence: number;
  /**
   * What to pay: earned less cash and penalties. Below zero, the driver owes
   * Cityline.
   */
  netPence: number;
}

export function payTotals(
  jobs: readonly PayJob[],
  penalties: readonly Pick<PenaltyLine, "driverSharePence">[] = [],
): PayTotals {
  const earnedPence = jobs.reduce((sum, job) => sum + (job.driverPricePence ?? 0), 0);
  const cashPence = jobs.reduce((sum, job) => sum + cashHeldPence(job), 0);
  const penaltiesPence = driverSharesTotal(penalties);
  return {
    earnedPence,
    cashPence,
    penaltiesPence,
    netPence: earnedPence - cashPence - penaltiesPence,
  };
}

export interface DriverOwed extends PayTotals {
  /** Done and priced, not yet paid, up to the chosen date. */
  payable: PayJob[];
  /** Done, but no driver price written: cannot be paid yet. */
  missingPrice: PayJob[];
  /** Penalty shares not yet taken off a payment, whatever their date. */
  penalties: PenaltyLine[];
}

/**
 * What a driver is owed for bookings picked up before `before`, less their
 * share of partner penalties not yet taken off.
 */
export function owedUpTo(
  jobs: readonly PayJob[],
  before: Date,
  penalties: readonly PenaltyLine[] = [],
): DriverOwed {
  const inRange = jobs.filter(
    (job) =>
      isWorkDone(job) &&
      job.driverPaymentId === null &&
      new Date(job.pickupAt).getTime() < before.getTime(),
  );
  const payable = inRange.filter((job) => job.driverPricePence !== null);
  return {
    payable,
    missingPrice: inRange.filter((job) => job.driverPricePence === null),
    penalties: [...penalties],
    ...payTotals(payable, penalties),
  };
}

/** "DP-000012" — a payment's reference, from its number. */
export function paymentReference(id: number): string {
  return `DP-${String(id).padStart(6, "0")}`;
}

export const PAYMENT_METHODS = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** A London day, "YYYY-MM-DD", plus whole days. */
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The first day a payment covers (Cityline, 14 Oct 2026): the day after the
 * driver's last payment, whatever days they worked in between — paid on the
 * 13th, then up to the 25th, the second covers the 14th to the 25th.
 *
 *   - `previousUpTo` is the day the driver's last payment ran up to: the
 *     latest of their payments not voided that ran up to an earlier day.
 *   - A first payment starts on its first booking's day.
 *   - A booking older than that, paid late (its price written late, or paid
 *     again after a void), moves the start back to its day, so every booking
 *     on the statement falls inside the period.
 *
 * All days are London days, "YYYY-MM-DD".
 */
export function paymentPeriodStart(args: {
  upTo: string;
  previousUpTo: string | null;
  firstBooking: string;
}): string {
  const afterPrevious = args.previousUpTo
    ? addDays(args.previousUpTo, 1)
    : args.firstBooking;
  return [afterPrevious, args.firstBooking, args.upTo].sort()[0]!;
}

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  day: "numeric",
  month: "short",
});
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const londonYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIMEZONE,
  year: "numeric",
});

/**
 * A payment's period in words: "14 Oct – 25 Oct 2026", one day as
 * "13 Oct 2026", across a new year "28 Dec 2026 – 3 Jan 2027".
 */
export function paymentPeriod(from: Date, to: Date): string {
  const end = dayMonthYear.format(to);
  if (dayMonthYear.format(from) === end) return end;
  return londonYear.format(from) === londonYear.format(to)
    ? `${dayMonth.format(from)} – ${end}`
    : `${dayMonthYear.format(from)} – ${end}`;
}
