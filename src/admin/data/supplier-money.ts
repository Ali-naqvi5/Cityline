import "server-only";

import type { Payload } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import type { InvoiceData } from "@/domain/finance/invoice-pdf";
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
  Supplier,
  SupplierInvoice,
  SupplierPayment,
  User,
} from "@/payload-types";

/**
 * Loading Supplier Money: what each partner owes up to a chosen day, the
 * money received, the invoices made, and an invoice as its PDF. Test
 * bookings are never billed. Owner and Accounts.
 */

type As = { user: User; overrideAccess: false };

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
  const [jobs, suppliers] = await Promise.all([
    partnerJobs(payload, as, before),
    payload.find({ collection: "suppliers", pagination: false, depth: 0, ...as }),
  ]);
  const byPartner = new Map<number, PartnerJob[]>();
  for (const job of jobs) {
    const supplierId = relId(job.supplier);
    if (supplierId === null) continue;
    byPartner.set(supplierId, [...(byPartner.get(supplierId) ?? []), toPartnerJob(job)]);
  }
  return (suppliers.docs as Supplier[])
    .filter((supplier) => byPartner.has(supplier.id))
    .map((supplier) => ({
      supplier,
      owed: partnerOwed(
        byPartner.get(supplier.id)!,
        before,
        supplier.paymentTermsDays ?? null,
        now,
      ),
    }))
    .filter((row) => row.owed.owed.length || row.owed.toDecide.length)
    .sort((a, b) => b.owed.totalPence - a.owed.totalPence);
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

  const [jobs, receipts, invoices] = await Promise.all([
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
    ),
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
