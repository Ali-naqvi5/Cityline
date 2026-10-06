import "server-only";

import type { Payload } from "payload";

import type { Period } from "@/admin/reports/period";
import { relId } from "@/domain/dispatch/assignment";
import { financeOverview, type FinanceOverview } from "@/domain/finance/overview";
import type { CancellationCharge } from "@/domain/finance/supplier-money";
import type { JobStatus } from "@/domain/jobs/labels";
import { staffCan } from "@/domain/staff/permissions";
import type { Job, Refund, User } from "@/payload-types";

/**
 * The accounts overview (the three rings): the bookings picked up in the
 * chosen dates, test bookings never, reduced to what was earned, paid and
 * received — less the refunds recorded on them, and Cityline's own expenses
 * in the same dates. Owner and Accounts.
 */
export async function loadFinanceOverview(
  payload: Payload,
  user: User,
  period: Pick<Period, "start" | "end">,
): Promise<FinanceOverview> {
  const [found, expenses] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          { isTest: { not_equals: true } },
          { status: { in: ["completed", "no_show", "cancelled"] } },
          { pickupAt: { greater_than_equal: period.start.toISOString() } },
          { pickupAt: { less_than: period.end.toISOString() } },
        ],
      },
      pagination: false,
      depth: 0,
      select: {
        status: true,
        source: true,
        customerPricePence: true,
        driverPricePence: true,
        paymentFeePence: true,
        cancellationCharge: true,
        driverPayment: true,
        supplierPayment: true,
      },
      user,
      overrideAccess: false,
    }),
    // Cityline's own expenses in the same dates; void ones never count.
    payload.find({
      collection: "expenses",
      where: {
        and: [
          { voidedAt: { exists: false } },
          { spentAt: { greater_than_equal: period.start.toISOString() } },
          { spentAt: { less_than: period.end.toISOString() } },
        ],
      },
      pagination: false,
      depth: 0,
      select: { amountPence: true },
      user,
      overrideAccess: false,
    }),
  ]);
  // Refunds recorded against these bookings; void ones never count.
  const jobs = found.docs as Job[];
  const refunded = new Map<number, number>();
  if (jobs.length && staffCan(user, "refunds.view")) {
    const refunds = await payload.find({
      collection: "refunds",
      where: {
        and: [
          { voidedAt: { exists: false } },
          { "lines.job": { in: jobs.map((job) => job.id) } },
        ],
      },
      pagination: false,
      depth: 0,
      select: { lines: true },
      user,
      overrideAccess: false,
    });
    for (const refund of refunds.docs as Refund[]) {
      for (const line of refund.lines ?? []) {
        const jobId = relId(line.job);
        if (jobId)
          refunded.set(jobId, (refunded.get(jobId) ?? 0) + (line.amountPence ?? 0));
      }
    }
  }
  return financeOverview(
    jobs.map((job) => ({
      status: job.status as JobStatus,
      source: job.source,
      customerPricePence: job.customerPricePence ?? null,
      driverPricePence: job.driverPricePence ?? null,
      paymentFeePence: job.paymentFeePence ?? null,
      cancellationCharge: (job.cancellationCharge ?? null) as CancellationCharge | null,
      driverPaymentId: relId(job.driverPayment),
      supplierPaymentId: relId(job.supplierPayment),
      refundedPence: refunded.get(job.id) ?? 0,
    })),
    expenses.docs.reduce((sum, expense) => sum + (expense.amountPence ?? 0), 0),
  );
}
