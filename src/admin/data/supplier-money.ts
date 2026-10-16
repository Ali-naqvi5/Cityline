import "server-only";

import type { Payload } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import type { InvoiceData } from "@/domain/finance/invoice-pdf";
import type { PenaltyLine } from "@/domain/finance/penalties";
import {
  invoiceNumber,
  partnerOwed,
  RECEIPT_METHODS,
  receiptReference,
  type CancellationCharge,
  type PartnerJob,
  type PartnerOwed,
  type ReceiptMethod,
} from "@/domain/finance/supplier-money";
import type { JobStatus } from "@/domain/jobs/labels";
import { company, formattedAddress } from "@/lib/company";
import type { CsvColumn } from "@/lib/csv";
import type {
  Job,
  PartnerPenalty,
  Supplier,
  SupplierInvoice,
  SupplierPayment,
  User,
} from "@/payload-types";

/**
 * Loading Supplier Money: what each partner owes up to a chosen day, less
 * their penalties not yet taken off, the money received, the invoices made,
 * and an invoice as its PDF. Test bookings are never billed. Owner and
 * Accounts.
 */

type As = { user: User; overrideAccess: false };

export function toPenaltyLine(penalty: PartnerPenalty): PenaltyLine {
  return {
    id: penalty.id,
    jobId: relId(penalty.job) ?? 0,
    jobReference: penalty.jobReference ?? "",
    supplierReference: penalty.supplierReference ?? null,
    penalisedAt: penalty.penalisedAt,
    reason: penalty.reason,
    amountPence: penalty.amountPence,
    driverSharePence: penalty.driverSharePence ?? 0,
  };
}

/**
 * Partner penalties (Cityline, 16 Oct 2026) not void and not yet taken off a
 * partner's payment: for one partner, or all of them.
 */
async function openPenalties(
  payload: Payload,
  as: As,
  supplierId?: number,
): Promise<PartnerPenalty[]> {
  const found = await payload.find({
    collection: "partner-penalties",
    where: {
      and: [
        { voidedAt: { exists: false } },
        { supplierPayment: { exists: false } },
        ...(supplierId ? [{ supplier: { equals: supplierId } }] : []),
      ],
    },
    sort: "penalisedAt",
    pagination: false,
    depth: 0,
    ...as,
  });
  return found.docs as PartnerPenalty[];
}

/** Every penalty on one booking, void ones too, oldest first. */
export async function loadJobPenalties(
  payload: Payload,
  user: User,
  jobId: number,
): Promise<PartnerPenalty[]> {
  const found = await payload.find({
    collection: "partner-penalties",
    where: { job: { equals: jobId } },
    sort: "createdAt",
    pagination: false,
    depth: 1,
    user,
    overrideAccess: false,
  });
  return found.docs as PartnerPenalty[];
}

export function toPartnerJob(job: Job): PartnerJob {
  return {
    id: job.id,
    reference: job.reference,
    supplierReference: job.supplierReference ?? null,
    status: job.status as JobStatus,
    pickupAt: job.pickupAt,
    pickupAddress: job.pickupAddress,
    dropoffAddress: job.dropoffAddress ?? null,
    hours: job.hours ?? null,
    pricePence: job.customerPricePence ?? null,
    cancellationCharge: (job.cancellationCharge ?? null) as CancellationCharge | null,
    supplierPaymentId: relId(job.supplierPayment),
    supplierInvoiceId: relId(job.supplierInvoice),
  };
}

/** Partner bookings that may be billed, picked up before `before`. */
async function partnerJobs(
  payload: Payload,
  as: As,
  before: Date,
  supplierId?: number,
): Promise<Job[]> {
  const found = await payload.find({
    collection: "jobs",
    where: {
      and: [
        { source: { equals: "supplier" } },
        { isTest: { not_equals: true } },
        { status: { in: ["completed", "no_show", "cancelled"] } },
        { supplierPayment: { exists: false } },
        { pickupAt: { less_than: before.toISOString() } },
        ...(supplierId ? [{ supplier: { equals: supplierId } }] : []),
      ],
    },
    sort: "pickupAt",
    pagination: false,
    depth: 0,
    ...as,
  });
  return found.docs as Job[];
}

export interface PartnerRow {
  supplier: Supplier;
  owed: PartnerOwed;
}

export async function loadPartnersOwed(
  payload: Payload,
  user: User,
  before: Date,
  now: Date,
): Promise<PartnerRow[]> {
  const as: As = { user, overrideAccess: false };
  const [jobs, suppliers, penalties] = await Promise.all([
    partnerJobs(payload, as, before),
    payload.find({ collection: "suppliers", pagination: false, depth: 0, ...as }),
    openPenalties(payload, as),
  ]);
  const byPartner = new Map<number, PartnerJob[]>();
  for (const job of jobs) {
    const supplierId = relId(job.supplier);
    if (supplierId === null) continue;
    byPartner.set(supplierId, [...(byPartner.get(supplierId) ?? []), toPartnerJob(job)]);
  }
  const finedPartner = new Map<number, PenaltyLine[]>();
  for (const penalty of penalties) {
    const supplierId = relId(penalty.supplier);
    if (supplierId === null) continue;
    finedPartner.set(supplierId, [
      ...(finedPartner.get(supplierId) ?? []),
      toPenaltyLine(penalty),
    ]);
  }
  return (suppliers.docs as Supplier[])
    .filter((supplier) => byPartner.has(supplier.id) || finedPartner.has(supplier.id))
    .map((supplier) => ({
      supplier,
      owed: partnerOwed(
        byPartner.get(supplier.id) ?? [],
        before,
        supplier.paymentTermsDays ?? null,
        now,
        finedPartner.get(supplier.id) ?? [],
      ),
    }))
    .filter(
      (row) =>
        row.owed.owed.length || row.owed.toDecide.length || row.owed.penalties.length,
    )
    .sort((a, b) => b.owed.netPence - a.owed.netPence);
}

/** Money received between `start` and `end`, newest first. */
export async function loadReceipts(
  payload: Payload,
  user: User,
  range: { start: Date; end: Date },
): Promise<SupplierPayment[]> {
  const found = await payload.find({
    collection: "supplier-payments",
    where: {
      and: [
        { receivedAt: { greater_than_equal: range.start.toISOString() } },
        { receivedAt: { less_than: range.end.toISOString() } },
      ],
    },
    sort: "-receivedAt",
    pagination: false,
    depth: 1,
    user,
    overrideAccess: false,
  });
  return found.docs as SupplierPayment[];
}

/** What came in, in total — void receipts never count. */
export function receivedTotal(receipts: readonly SupplierPayment[]): number {
  return receipts
    .filter((receipt) => !receipt.voidedAt)
    .reduce((sum, receipt) => sum + (receipt.amountPence ?? 0), 0);
}

export type InvoiceState = "paid" | "part_paid" | "unpaid" | "overdue" | "void";

export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  paid: "Paid",
  part_paid: "Part paid",
  unpaid: "Unpaid",
  overdue: "Overdue",
  void: "Void",
};

export interface PartnerData {
  supplier: Supplier;
  owed: PartnerOwed;
  /** Open penalties already on an invoice: they cannot go on another. */
  invoicedPenalties: Map<number, number>;
  /** Every penalty recorded for this partner, void ones too, newest first. */
  penalties: PartnerPenalty[];
  receipts: SupplierPayment[];
  invoices: (SupplierInvoice & { state: InvoiceState })[];
}

export async function loadPartner(
  payload: Payload,
  user: User,
  supplierId: number,
  before: Date,
  now: Date,
): Promise<PartnerData | null> {
  const as: As = { user, overrideAccess: false };
  const supplier = (await payload.findByID({
    collection: "suppliers",
    id: supplierId,
    depth: 0,
    disableErrors: true,
    ...as,
  })) as Supplier | null;
  if (!supplier) return null;

  const [jobs, receipts, invoices, open, penalties] = await Promise.all([
    partnerJobs(payload, as, before, supplierId),
    payload.find({
      collection: "supplier-payments",
      where: { supplier: { equals: supplierId } },
      sort: "-receivedAt",
      pagination: false,
      depth: 1,
      ...as,
    }),
    payload.find({
      collection: "supplier-invoices",
      where: { supplier: { equals: supplierId } },
      sort: "-issuedAt",
      pagination: false,
      depth: 0,
      ...as,
    }),
    openPenalties(payload, as, supplierId),
    payload.find({
      collection: "partner-penalties",
      where: { supplier: { equals: supplierId } },
      sort: "-penalisedAt",
      pagination: false,
      depth: 1,
      ...as,
    }),
  ]);

  // Whether each invoice's bookings have been paid for.
  const invoiceIds = invoices.docs.map((invoice) => invoice.id);
  const invoiced = invoiceIds.length
    ? await payload.find({
        collection: "jobs",
        where: { supplierInvoice: { in: invoiceIds } },
        pagination: false,
        depth: 0,
        select: { supplierInvoice: true, supplierPayment: true },
        ...as,
      })
    : { docs: [] };
  const paidByInvoice = new Map<number, { paid: number; all: number }>();
  for (const job of invoiced.docs as Job[]) {
    const invoiceId = relId(job.supplierInvoice);
    if (invoiceId === null) continue;
    const entry = paidByInvoice.get(invoiceId) ?? { paid: 0, all: 0 };
    entry.all += 1;
    if (relId(job.supplierPayment)) entry.paid += 1;
    paidByInvoice.set(invoiceId, entry);
  }
  const stateOf = (invoice: SupplierInvoice): InvoiceState => {
    if (invoice.voidedAt) return "void";
    const entry = paidByInvoice.get(invoice.id);
    if (entry && entry.all > 0 && entry.paid === entry.all) return "paid";
    if (entry && entry.paid > 0) return "part_paid";
    return invoice.dueAt && new Date(invoice.dueAt) < now ? "overdue" : "unpaid";
  };

  return {
    supplier,
    owed: partnerOwed(
      jobs.map(toPartnerJob),
      before,
      supplier.paymentTermsDays ?? null,
      now,
      open.map(toPenaltyLine),
    ),
    invoicedPenalties: new Map(
      open
        .filter((penalty) => relId(penalty.supplierInvoice))
        .map((penalty) => [penalty.id, relId(penalty.supplierInvoice)!]),
    ),
    penalties: penalties.docs as PartnerPenalty[],
    receipts: receipts.docs as SupplierPayment[],
    invoices: (invoices.docs as SupplierInvoice[]).map((invoice) => ({
      ...invoice,
      state: stateOf(invoice),
    })),
  };
}

/** An invoice as its PDF. */
export async function invoiceFor(
  payload: Payload,
  invoiceId: number,
  as: As,
  now: Date,
): Promise<InvoiceData | null> {
  const invoice = (await payload.findByID({
    collection: "supplier-invoices",
    id: invoiceId,
    depth: 0,
    disableErrors: true,
    ...as,
  })) as SupplierInvoice | null;
  if (!invoice) return null;
  const supplierId = relId(invoice.supplier);
  const supplier = supplierId
    ? ((await payload.findByID({
        collection: "suppliers",
        id: supplierId,
        depth: 0,
        disableErrors: true,
        ...as,
      })) as Supplier | null)
    : null;
  return {
    number: invoiceNumber(invoice.id),
    issuedAt: new Date(invoice.issuedAt),
    dueAt: new Date(invoice.dueAt ?? invoice.issuedAt),
    termsDays: supplier?.paymentTermsDays ?? null,
    voided: Boolean(invoice.voidedAt),
    partner: {
      name: supplier?.name ?? "Partner",
      billingAddress: supplier?.billingAddress ?? null,
      contactName: supplier?.contactName ?? null,
    },
    lines: (invoice.lines ?? []).map((line) => ({
      pickupAt: new Date(line.pickupAt ?? invoice.issuedAt),
      reference: line.jobReference ?? "",
      supplierReference: line.supplierReference ?? null,
      route: line.route ?? "",
      status: line.status ?? "",
      amountPence: line.amountPence ?? 0,
    })),
    penalties: (invoice.penalties ?? []).map((line) => ({
      penalisedAt: new Date(line.penalisedAt ?? invoice.issuedAt),
      reference: line.jobReference ?? "",
      supplierReference: line.supplierReference ?? null,
      reason: line.reason ?? "",
      amountPence: line.amountPence ?? 0,
    })),
    totalPence: invoice.totalPence ?? 0,
    company: {
      legalName: company.legalName,
      address: formattedAddress(),
      phone: company.phone,
      email: company.email,
      companyNumber: company.companyNumber,
    },
    generatedAt: now,
  };
}

const csvDay = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
        new Date(iso),
      )
    : "";
const pounds = (pence: number | null | undefined) => ((pence ?? 0) / 100).toFixed(2);

/** One row per payment received from a partner. */
export const PARTNER_RECEIPTS_CSV_COLUMNS: CsvColumn<SupplierPayment>[] = [
  { header: "Receipt", value: (row) => receiptReference(row.id) },
  { header: "Date received", value: (row) => csvDay(row.receivedAt) },
  {
    header: "Partner",
    value: (row) =>
      row.supplier && typeof row.supplier === "object"
        ? (row.supplier as Supplier).name
        : String(relId(row.supplier) ?? ""),
  },
  { header: "Bookings", value: (row) => row.lines?.length ?? 0 },
  {
    header: "Bookings (£)",
    value: (row) => pounds(row.bookingsPence ?? row.amountPence),
  },
  { header: "Penalties taken off (£)", value: (row) => pounds(row.penaltiesPence) },
  { header: "Amount (£)", value: (row) => pounds(row.amountPence) },
  {
    header: "Method",
    value: (row) => RECEIPT_METHODS[row.method as ReceiptMethod] ?? row.method,
  },
  { header: "Their reference", value: (row) => row.reference },
  {
    header: "Recorded by",
    value: (row) =>
      row.recordedBy && typeof row.recordedBy === "object"
        ? ((row.recordedBy as User).name ?? (row.recordedBy as User).email)
        : "",
  },
  {
    header: "Void",
    value: (row) => (row.voidedAt ? `Yes: ${row.voidReason ?? ""}` : ""),
  },
];
