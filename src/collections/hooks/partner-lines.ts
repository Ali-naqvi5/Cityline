import { ValidationError, type PayloadRequest } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import { penaltyReference } from "@/domain/finance/penalties";
import {
  isChargeable,
  partnerRoute,
  type CancellationCharge,
} from "@/domain/finance/supplier-money";
import type { JobStatus } from "@/domain/jobs/labels";
import type { Job, PartnerPenalty } from "@/payload-types";

/**
 * Shared by partner receipts and invoices (Supplier Money): turn the bookings
 * chosen into lines, from the bookings themselves, refusing any that are not
 * this partner's, not chargeable, unpriced, or already covered.
 */

export interface PartnerLine {
  job: number;
  jobReference: string;
  supplierReference: string | null;
  pickupAt: string;
  route: string;
  status: string;
  amountPence: number;
}

export function failOn(collection: string, req: PayloadRequest) {
  return (path: string, message: string): never => {
    throw new ValidationError({ collection, errors: [{ path, message }], req });
  };
}

export async function partnerLines(
  req: PayloadRequest,
  collection: string,
  supplierId: number,
  requested: unknown,
  covered: "supplierPayment" | "supplierInvoice",
): Promise<PartnerLine[]> {
  const fail = failOn(collection, req);
  const ids = [
    ...new Set(
      ((requested ?? []) as { job?: unknown }[])
        .map((line) => relId(line.job))
        .filter((id): id is number => id !== null),
    ),
  ];
  if (ids.length === 0) fail("lines", "Choose at least one booking.");
  const found = await req.payload.find({
    collection: "jobs",
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (found.docs.length !== ids.length)
    fail("lines", "One of those bookings is not on record.");

  const jobs = (found.docs as Job[]).sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
  for (const job of jobs) {
    if (job.source !== "supplier" || relId(job.supplier) !== supplierId) {
      fail("lines", `${job.reference} was not sent by this partner.`);
    }
    const chargeable = isChargeable({
      status: job.status as JobStatus,
      cancellationCharge: (job.cancellationCharge ?? null) as CancellationCharge | null,
    });
    if (!chargeable) {
      fail(
        "lines",
        job.status === "cancelled"
          ? `${job.reference} is cancelled and not charged to the partner.`
          : `${job.reference} is not completed or PNS.`,
      );
    }
    if (job.customerPricePence === null || job.customerPricePence === undefined) {
      fail("lines", `${job.reference} has no price.`);
    }
    if (relId(job.supplierPayment)) fail("lines", `${job.reference} is already paid.`);
    if (covered === "supplierInvoice" && relId(job.supplierInvoice)) {
      fail("lines", `${job.reference} is already on an invoice.`);
    }
  }
  return jobs.map((job) => ({
    job: job.id,
    jobReference: job.reference,
    supplierReference: job.supplierReference ?? null,
    pickupAt: job.pickupAt,
    route: partnerRoute({
      pickupAddress: job.pickupAddress,
      dropoffAddress: job.dropoffAddress ?? null,
      hours: job.hours ?? null,
    }).slice(0, 300),
    status:
      job.status === "cancelled"
        ? "Late cancellation"
        : job.status === "no_show"
          ? "PNS"
          : "Completed",
    amountPence: job.customerPricePence!,
  }));
}

/** A penalty a partner payment or invoice takes off, as it was then. */
export interface PartnerPenaltyLine {
  penalty: number;
  penaltyReference: string;
  jobReference: string;
  supplierReference: string | null;
  penalisedAt: string;
  reason: string;
  amountPence: number;
}

/**
 * Partner penalties (Cityline, 16 Oct 2026) taken off a partner's payment,
 * or shown on an invoice: turned into lines from the penalties themselves,
 * refusing any that are void, another partner's, or already taken off one.
 */
export async function partnerPenaltyLines(
  req: PayloadRequest,
  collection: string,
  supplierId: number,
  requested: unknown,
  covered: "supplierPayment" | "supplierInvoice",
): Promise<PartnerPenaltyLine[]> {
  const fail = failOn(collection, req);
  const ids = [
    ...new Set(
      ((requested ?? []) as { penalty?: unknown }[])
        .map((line) => relId(line.penalty))
        .filter((id): id is number => id !== null),
    ),
  ];
  if (ids.length === 0) return [];
  const found = await req.payload.find({
    collection: "partner-penalties",
    where: { id: { in: ids } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  });
  if (found.docs.length !== ids.length)
    fail("penalties", "One of those penalties is not on record.");
  const penalties = (found.docs as PartnerPenalty[]).sort((a, b) =>
    a.penalisedAt.localeCompare(b.penalisedAt),
  );
  for (const penalty of penalties) {
    const reference = penaltyReference(penalty.id);
    if (penalty.voidedAt) fail("penalties", `${reference} is void.`);
    if (relId(penalty.supplier) !== supplierId) {
      fail("penalties", `${reference} is not this partner's.`);
    }
    if (relId(penalty.supplierPayment)) {
      fail("penalties", `${reference} was already taken off a payment.`);
    }
    if (covered === "supplierInvoice" && relId(penalty.supplierInvoice)) {
      fail("penalties", `${reference} is already on an invoice.`);
    }
  }
  return penalties.map((penalty) => ({
    penalty: penalty.id,
    penaltyReference: penaltyReference(penalty.id),
    jobReference: penalty.jobReference ?? "",
    supplierReference: penalty.supplierReference ?? null,
    penalisedAt: penalty.penalisedAt,
    reason: (penalty.reason ?? "").slice(0, 300),
    amountPence: penalty.amountPence,
  }));
}

/** Point each penalty taken off at its record — or free them on a void. */
export async function linkPenalties(
  req: PayloadRequest,
  field: "supplierPayment" | "supplierInvoice" | "driverPayment",
  doc: {
    id: number;
    penalties?: { penalty?: unknown }[] | null;
    voidedAt?: string | null;
  },
  previous: { voidedAt?: string | null } | undefined,
  operation: string,
): Promise<void> {
  const voided = operation === "update" && doc.voidedAt && !previous?.voidedAt;
  if (operation !== "create" && !voided) return;
  for (const line of doc.penalties ?? []) {
    const penaltyId = relId(line.penalty);
    if (!penaltyId) continue;
    await req.payload.update({
      collection: "partner-penalties",
      id: penaltyId,
      data: { [field]: voided ? null : doc.id },
      overrideAccess: true,
      req,
    });
  }
}

/**
 * A record that is never edited: only the listed fields may change, and a
 * void record not at all. Voiding needs a reason and stamps who and when.
 */
export function onlyChange(
  collection: string,
  allowed: readonly string[],
): (args: {
  data: Record<string, unknown>;
  originalDoc?: Record<string, unknown>;
  req: PayloadRequest;
}) => Record<string, unknown> {
  const free = new Set([...allowed, "voidedAt", "voidReason", "voidedBy", "updatedAt"]);
  return ({ data, originalDoc, req }) => {
    const fail = failOn(collection, req);
    const original = originalDoc ?? {};
    if (original.voidedAt) fail("voidReason", "This is void and cannot change.");
    for (const [key, value] of Object.entries(data)) {
      if (free.has(key)) continue;
      if (JSON.stringify(value ?? null) !== JSON.stringify(original[key] ?? null)) {
        fail(key, "This cannot be changed. Void it, with a reason, and record it again.");
      }
    }
    if (data.voidReason && !original.voidReason) {
      const reason = String(data.voidReason).trim();
      if (!reason) fail("voidReason", "Write why this is void.");
      data.voidReason = reason;
      data.voidedAt = new Date().toISOString();
      data.voidedBy = req.user?.id ?? null;
    }
    return data;
  };
}

/** Point each covered booking at its record — or free them on a void. */
export async function linkBookings(
  req: PayloadRequest,
  field: "supplierPayment" | "supplierInvoice",
  doc: { id: number; lines?: { job?: unknown }[] | null; voidedAt?: string | null },
  previous: { voidedAt?: string | null } | undefined,
  operation: string,
): Promise<void> {
  const voided = operation === "update" && doc.voidedAt && !previous?.voidedAt;
  if (operation !== "create" && !voided) return;
  for (const line of doc.lines ?? []) {
    const jobId = relId(line.job);
    if (!jobId) continue;
    await req.payload.update({
      collection: "jobs",
      id: jobId,
      data: { [field]: voided ? null : doc.id },
      overrideAccess: true,
      req,
    });
  }
}
