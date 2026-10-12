import "server-only";

import type { Payload } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import { summarise, type CustomerSummary } from "@/domain/customers/summary";
import type { Job, User } from "@/payload-types";

/**
 * Each listed customer's history in figures, from one query for the page's
 * customers rather than one per row.
 */
export async function loadCustomerSummaries(
  payload: Payload,
  user: User,
  ids: number[],
  now: Date,
): Promise<Map<number, CustomerSummary>> {
  const summaries = new Map<number, CustomerSummary>();
  if (ids.length === 0) return summaries;

  const jobs = await payload.find({
    collection: "jobs",
    where: { and: [{ customer: { in: ids } }, { archivedAt: { exists: false } }] },
    pagination: false,
    depth: 0,
    select: { customer: true, status: true, pickupAt: true, customerPricePence: true },
    user,
    overrideAccess: false,
  });

  const byCustomer = new Map<number, Job[]>();
  for (const job of jobs.docs as Job[]) {
    const id = relId(job.customer);
    if (id === null) continue;
    byCustomer.set(id, [...(byCustomer.get(id) ?? []), job]);
  }
  for (const id of ids) summaries.set(id, summarise(byCustomer.get(id) ?? [], now));
  return summaries;
}
