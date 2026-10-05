import type { JobStatus } from "@/domain/jobs/labels";

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
  /** What to pay: earned less cash. Below zero, the driver owes Cityline. */
  netPence: number;
}

export function payTotals(jobs: readonly PayJob[]): PayTotals {
  const earnedPence = jobs.reduce((sum, job) => sum + (job.driverPricePence ?? 0), 0);
  const cashPence = jobs.reduce((sum, job) => sum + cashHeldPence(job), 0);
  return { earnedPence, cashPence, netPence: earnedPence - cashPence };
}

export interface DriverOwed extends PayTotals {
  /** Done and priced, not yet paid, up to the chosen date. */
  payable: PayJob[];
  /** Done, but no driver price written: cannot be paid yet. */
  missingPrice: PayJob[];
}

/** What a driver is owed for bookings picked up before `before`. */
export function owedUpTo(jobs: readonly PayJob[], before: Date): DriverOwed {
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
    ...payTotals(payable),
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
