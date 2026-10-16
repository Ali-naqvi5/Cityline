import type { JobStatus } from "@/domain/jobs/labels";

import { isChargeable, type CancellationCharge } from "./supplier-money";

/**
 * The accounts overview's three rings (approved by Cityline, 6 Oct 2026),
 * for the bookings picked up in the chosen dates:
 *
 *   - Paid to drivers — of the driver prices on work done, how much is paid.
 *   - Got from suppliers — of what partners owe for their bookings, how much
 *     has come in.
 *   - Profit — booking prices, less refunds made on them, less driver
 *     prices, less card fees, less the partner penalties on them that
 *     Cityline bears (16 Oct 2026), less Cityline's own expenses in the same
 *     dates; the ring is the margin, below zero on a loss.
 *
 * Work done is a completed booking or a PNS; a late cancellation a partner
 * pays for earns its price too. A cancelled booking earns nothing, so
 * refunding it changes nothing here. A partner's penalty comes off what that
 * partner owes, whichever booking it is on. Test bookings are never counted.
 */

export interface OverviewJob {
  status: JobStatus;
  source: string;
  customerPricePence: number | null;
  driverPricePence: number | null;
  paymentFeePence: number | null;
  cancellationCharge: CancellationCharge | null;
  driverPaymentId: number | null;
  supplierPaymentId: number | null;
  /** Refunds recorded against this booking, whenever made. */
  refundedPence?: number;
  /** Partner penalties on this booking, not void. */
  penaltyPence?: number;
  /** The part of them passed to the driver. */
  penaltyFromDriverPence?: number;
  /** The part of them already taken off a partner's payment. */
  penaltySettledPence?: number;
}

export interface FinanceOverview {
  drivers: { earnedPence: number; paidPence: number; unpriced: number };
  suppliers: { owedPence: number; receivedPence: number };
  profit: {
    incomePence: number;
    refundsPence: number;
    driverPence: number;
    feesPence: number;
    /** Partner penalties on these bookings, all of them. */
    penaltiesPence: number;
    /** The part of the penalties passed to drivers. */
    penaltiesFromDriversPence: number;
    expensesPence: number;
    profitPence: number;
    /** Profit as a share of income after refunds; null with none. */
    margin: number | null;
  };
}

const isDone = (job: OverviewJob) =>
  job.status === "completed" || job.status === "no_show";

export function financeOverview(
  jobs: readonly OverviewJob[],
  expensesPence = 0,
): FinanceOverview {
  const done = jobs.filter(isDone);
  const priced = done.filter((job) => job.driverPricePence !== null);
  const earnedPence = priced.reduce((sum, job) => sum + job.driverPricePence!, 0);
  const paidPence = priced
    .filter((job) => job.driverPaymentId !== null)
    .reduce((sum, job) => sum + job.driverPricePence!, 0);

  // What partners owe for their bookings, less the penalties they take off;
  // what came in, less the penalties already taken off a payment.
  const sumOf = (list: readonly OverviewJob[], value: (job: OverviewJob) => number) =>
    list.reduce((total, job) => total + value(job), 0);
  const partner = jobs.filter((job) => job.source === "supplier" && isChargeable(job));
  const fined = jobs.filter((job) => job.source === "supplier");
  const owedPence =
    sumOf(partner, (job) => job.customerPricePence ?? 0) -
    sumOf(fined, (job) => job.penaltyPence ?? 0);
  const receivedPence =
    sumOf(
      partner.filter((job) => job.supplierPaymentId !== null),
      (job) => job.customerPricePence ?? 0,
    ) - sumOf(fined, (job) => job.penaltySettledPence ?? 0);

  const earning = jobs.filter(
    (job) => isDone(job) || (job.source === "supplier" && isChargeable(job)),
  );
  const incomePence = earning.reduce(
    (sum, job) => sum + (job.customerPricePence ?? 0),
    0,
  );
  const refundsPence = earning.reduce((sum, job) => sum + (job.refundedPence ?? 0), 0);
  const feesPence = earning.reduce((sum, job) => sum + (job.paymentFeePence ?? 0), 0);
  const penaltiesPence = sumOf(jobs, (job) => job.penaltyPence ?? 0);
  const penaltiesFromDriversPence = sumOf(jobs, (job) => job.penaltyFromDriverPence ?? 0);
  const profitPence =
    incomePence -
    refundsPence -
    earnedPence -
    feesPence -
    (penaltiesPence - penaltiesFromDriversPence) -
    expensesPence;
  const keptPence = incomePence - refundsPence;

  return {
    drivers: { earnedPence, paidPence, unpriced: done.length - priced.length },
    suppliers: { owedPence, receivedPence },
    profit: {
      incomePence,
      refundsPence,
      driverPence: earnedPence,
      feesPence,
      penaltiesPence,
      penaltiesFromDriversPence,
      expensesPence,
      profitPence,
      margin: keptPence > 0 ? profitPence / keptPence : null,
    },
  };
}
