import type { JobStatus } from "@/domain/jobs/labels";

import { penaltiesTotal, type PenaltyLine } from "./penalties";

/**
 * Supplier Money (approved by Cityline, 6 Oct 2026): what each partner owes
 * Cityline for the bookings they sent. Partners take their cut before they
 * send a job, so the price on the booking is all Cityline's.
 *
 *   - A partner pays for a completed booking, a passenger no-show (PNS), and
 *     a late cancellation — the office decides, per cancelled booking,
 *     whether the partner pays or not; until then it is neither owed nor
 *     forgotten.
 *   - What is owed falls due the partner's payment terms after the pickup.
 *   - Money received is recorded against the bookings it covers, so none is
 *     counted twice. An invoice is a document the office chooses to make and
 *     send; it never goes anywhere by itself.
 *   - A partner's penalty comes off what they owe, and off the payment (and
 *     any invoice) it is taken from (Cityline, 16 Oct 2026).
 */

export type CancellationCharge = "charged" | "not_charged";

export interface PartnerJob {
  id: number;
  reference: string;
  supplierReference: string | null;
  status: JobStatus;
  pickupAt: string;
  pickupAddress: string;
  dropoffAddress: string | null;
  hours: number | null;
  /** The booking's price: what the partner pays Cityline. */
  pricePence: number | null;
  /** For a cancelled booking: does the partner still pay? Null until decided. */
  cancellationCharge: CancellationCharge | null;
  supplierPaymentId: number | null;
  supplierInvoiceId: number | null;
}

/** Work the partner pays for. */
export function isChargeable(
  job: Pick<PartnerJob, "status" | "cancellationCharge">,
): boolean {
  return (
    job.status === "completed" ||
    job.status === "no_show" ||
    (job.status === "cancelled" && job.cancellationCharge === "charged")
  );
}

/** Chargeable, priced and not yet paid. */
export function isOwed(job: PartnerJob): boolean {
  return isChargeable(job) && job.pricePence !== null && job.supplierPaymentId === null;
}

/** A cancelled booking whose charge nobody has decided yet. */
export function awaitingDecision(job: PartnerJob): boolean {
  return (
    job.status === "cancelled" &&
    job.cancellationCharge === null &&
    job.supplierPaymentId === null
  );
}

const DAY_MS = 86_400_000;

/** When the partner should have paid: their terms after the pickup. */
export function dueDate(
  job: Pick<PartnerJob, "pickupAt">,
  termsDays: number | null,
): Date {
  return new Date(new Date(job.pickupAt).getTime() + (termsDays ?? 0) * DAY_MS);
}

export interface PartnerOwed {
  owed: PartnerJob[];
  /** The bookings' prices. */
  totalPence: number;
  /** Penalties not yet taken off a payment, whatever their date. */
  penalties: PenaltyLine[];
  penaltiesPence: number;
  /** What they owe: the bookings less the penalties. */
  netPence: number;
  overduePence: number;
  /** Owed and on no invoice yet. */
  uninvoiced: number;
  toDecide: PartnerJob[];
}

/**
 * What a partner owes for bookings picked up before `before`, less their
 * penalties not yet taken off a payment.
 */
export function partnerOwed(
  jobs: readonly PartnerJob[],
  before: Date,
  termsDays: number | null,
  now: Date,
  penalties: readonly PenaltyLine[] = [],
): PartnerOwed {
  const inRange = jobs.filter(
    (job) => new Date(job.pickupAt).getTime() < before.getTime(),
  );
  const owed = inRange.filter(isOwed);
  const totalPence = owed.reduce((sum, job) => sum + (job.pricePence ?? 0), 0);
  const penaltiesPence = penaltiesTotal(penalties);
  return {
    owed,
    totalPence,
    penalties: [...penalties],
    penaltiesPence,
    netPence: totalPence - penaltiesPence,
    overduePence: owed
      .filter((job) => dueDate(job, termsDays).getTime() < now.getTime())
      .reduce((sum, job) => sum + (job.pricePence ?? 0), 0),
    uninvoiced: owed.filter((job) => job.supplierInvoiceId === null).length,
    toDecide: inRange.filter(awaitingDecision),
  };
}

export function partnerRoute(
  job: Pick<PartnerJob, "pickupAddress" | "dropoffAddress" | "hours">,
): string {
  return `${job.pickupAddress} to ${
    job.dropoffAddress ?? (job.hours ? `hourly hire, ${job.hours} hours` : "as directed")
  }`;
}

/** "INV-000007" — an invoice's number, from its record. */
export function invoiceNumber(id: number): string {
  return `INV-${String(id).padStart(6, "0")}`;
}

/** "PR-000007" — money received from a partner. */
export function receiptReference(id: number): string {
  return `PR-${String(id).padStart(6, "0")}`;
}

export const RECEIPT_METHODS = {
  bank_transfer: "Bank transfer",
  card: "Card",
  other: "Other",
} as const;
export type ReceiptMethod = keyof typeof RECEIPT_METHODS;
