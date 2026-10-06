import type { JobStatus } from "@/domain/jobs/labels";

import { isChargeable, type CancellationCharge } from "./supplier-money";

/**
 * The accounts overview's three rings (approved by Cityline, 6 Oct 2026),
 * for the bookings picked up in the chosen dates:
 *
 *   - Paid to drivers — of the driver prices on work done, how much is paid.
 *   - Got from suppliers — of what partners owe for their bookings, how much
 *     has come in.
 *   - Profit — booking prices, less driver prices, less Stripe's card fees;
 *     the ring is the margin. Expenses come off once they are recorded.
 *
 * Work done is a completed booking or a PNS; a late cancellation a partner
 * pays for earns its price too. Test bookings are never counted.
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
}

export interface FinanceOverview {
  drivers: { earnedPence: number; paidPence: number; unpriced: number };
  suppliers: { owedPence: number; receivedPence: number };
  profit: {
    incomePence: number;
    driverPence: number;
    feesPence: number;
    profitPence: number;
    /** Profit as a share of income; null with no income. */
    margin: number | null;
  };
}

const isDone = (job: OverviewJob) =>
  job.status === "completed" || job.status === "no_show";

export function financeOverview(jobs: readonly OverviewJob[]): FinanceOverview {
  const done = jobs.filter(isDone);
  const priced = done.filter((job) => job.driverPricePence !== null);
  const earnedPence = priced.reduce((sum, job) => sum + job.driverPricePence!, 0);
  const paidPence = priced
    .filter((job) => job.driverPaymentId !== null)
    .reduce((sum, job) => sum + job.driverPricePence!, 0);

  const partner = jobs.filter((job) => job.source === "supplier" && isChargeable(job));
  const owedPence = partner.reduce((sum, job) => sum + (job.customerPricePence ?? 0), 0);
  const receivedPence = partner
    .filter((job) => job.supplierPaymentId !== null)
    .reduce((sum, job) => sum + (job.customerPricePence ?? 0), 0);

  const earning = jobs.filter(
    (job) => isDone(job) || (job.source === "supplier" && isChargeable(job)),
  );
  const incomePence = earning.reduce(
    (sum, job) => sum + (job.customerPricePence ?? 0),
    0,
  );
  const feesPence = earning.reduce((sum, job) => sum + (job.paymentFeePence ?? 0), 0);
  const profitPence = incomePence - earnedPence - feesPence;

  return {
    drivers: { earnedPence, paidPence, unpriced: done.length - priced.length },
    suppliers: { owedPence, receivedPence },
    profit: {
      incomePence,
      driverPence: earnedPence,
      feesPence,
      profitPence,
      margin: incomePence > 0 ? profitPence / incomePence : null,
    },
  };
}
