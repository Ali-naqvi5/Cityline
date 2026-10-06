import "server-only";

import type { Payload } from "payload";

import type { Period } from "@/admin/reports/period";
import { relId } from "@/domain/dispatch/assignment";
import { financeOverview, type FinanceOverview } from "@/domain/finance/overview";
import type { CancellationCharge } from "@/domain/finance/supplier-money";
import type { JobStatus } from "@/domain/jobs/labels";
import type { Job, User } from "@/payload-types";

/**
 * The accounts overview (the three rings): the bookings picked up in the
 * chosen dates, test bookings never, reduced to what was earned, paid and
 * received. Owner and Accounts.
 */
export async function loadFinanceOverview(
  payload: Payload,
  user: User,
  period: Pick<Period, "start" | "end">,
): Promise<FinanceOverview> {
  const found = await payload.find({
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
  });
  return financeOverview(
    (found.docs as Job[]).map((job) => ({
      status: job.status as JobStatus,
      source: job.source,
      customerPricePence: job.customerPricePence ?? null,
      driverPricePence: job.driverPricePence ?? null,
      paymentFeePence: job.paymentFeePence ?? null,
      cancellationCharge: (job.cancellationCharge ?? null) as CancellationCharge | null,
      driverPaymentId: relId(job.driverPayment),
      supplierPaymentId: relId(job.supplierPayment),
    })),
  );
}
