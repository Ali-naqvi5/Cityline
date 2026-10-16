import "server-only";

import type { Payload } from "payload";

import { payeeOfPayment } from "@/admin/data/driver-pay";
import { paymentHref } from "@/admin/data/payments";
import { londonDay } from "@/admin/format";
import { expenseReference } from "@/collections/Expenses";
import { relId } from "@/domain/dispatch/assignment";
import {
  customerPaymentReference,
  refundReference,
} from "@/domain/finance/customer-money";
import { paymentReference } from "@/domain/finance/driver-pay";
import { penaltyReference } from "@/domain/finance/penalties";
import { receiptReference } from "@/domain/finance/supplier-money";
import type { CsvColumn } from "@/lib/csv";
import type {
  Booking,
  CustomerPayment,
  DriverPayment,
  Expense,
  Job,
  PartnerPenalty,
  Payment,
  Refund,
  Supplier,
  SupplierPayment,
  User,
} from "@/payload-types";

import {
  CITYLINE_SOURCE,
  MOVEMENT_LABELS,
  type Movement,
  type SourceRow,
} from "./finance-report";

/**
 * Loading Financial Reports: every movement of money between two dates, by
 * the day it moved — payments in, partners' money, cash settled with drivers,
 * refunds, card fees, drivers paid, partner penalties (on the payment they
 * were taken off) and expenses. Void records never count, nor test bookings.
 * Owner and Accounts.
 */

type As = { user: User; overrideAccess: false };
type Range = { start: Date; end: Date };

const inRange = (field: string, range: Range) => [
  { [field]: { greater_than_equal: range.start.toISOString() } },
  { [field]: { less_than: range.end.toISOString() } },
];
const NOT_VOID = { voidedAt: { exists: false } };

const WEBSITE = { source: "website", sourceLabel: "Website" };
const OFFICE = { source: "office", sourceLabel: "Office" };
const CITYLINE = { source: CITYLINE_SOURCE, sourceLabel: "Cityline's own costs" };

const at = (iso: string) => ({ day: londonDay(new Date(iso)), at: iso });

export interface FinanceReportData {
  movements: Movement[];
  /** Website payments in the period whose card fee Stripe has not given yet. */
  feesUnknown: number;
}

export async function loadFinanceMovements(
  payload: Payload,
  user: User,
  range: Range,
): Promise<FinanceReportData> {
  const as: As = { user, overrideAccess: false };
  const [website, office, partners, drivers, refunds, expenses, suppliers] =
    await Promise.all([
      payload.find({
        collection: "payments",
        where: {
          and: [
            { status: { equals: "succeeded" } },
            { "booking.isTest": { not_equals: true } },
            ...inRange("createdAt", range),
          ],
        },
        pagination: false,
        depth: 1,
        ...as,
      }),
      payload.find({
        collection: "customer-payments",
        where: { and: [NOT_VOID, ...inRange("paidAt", range)] },
        pagination: false,
        depth: 0,
        ...as,
      }),
      payload.find({
        collection: "supplier-payments",
        where: { and: [NOT_VOID, ...inRange("receivedAt", range)] },
        pagination: false,
        depth: 0,
        ...as,
      }),
      payload.find({
        collection: "driver-payments",
        where: { and: [NOT_VOID, ...inRange("paidAt", range)] },
        pagination: false,
        depth: 1,
        ...as,
      }),
      payload.find({
        collection: "refunds",
        where: { and: [NOT_VOID, ...inRange("refundedAt", range)] },
        pagination: false,
        depth: 0,
        ...as,
      }),
      payload.find({
        collection: "expenses",
        where: { and: [NOT_VOID, ...inRange("spentAt", range)] },
        pagination: false,
        depth: 0,
        ...as,
      }),
      payload.find({ collection: "suppliers", pagination: false, depth: 0, ...as }),
    ]);

  const partnerName = new Map(
    (suppliers.docs as Supplier[]).map((supplier) => [supplier.id, supplier.name]),
  );
  const partnerSource = (supplierId: number | null) =>
    supplierId
      ? {
          source: `partner-${supplierId}`,
          sourceLabel: partnerName.get(supplierId) ?? "Partner",
        }
      : { source: "partner-0", sourceLabel: "Partner" };

  // The partner penalties taken off partners' and drivers' payments: the
  // booking each was for.
  const penaltyIds = [
    ...(partners.docs as SupplierPayment[]).flatMap((receipt) =>
      (receipt.penalties ?? []).map((line) => relId(line.penalty)),
    ),
    ...(drivers.docs as DriverPayment[]).flatMap((payment) =>
      (payment.penalties ?? []).map((line) => relId(line.penalty)),
    ),
  ].filter((id): id is number => id !== null);
  const penaltyJob = new Map<number, number | null>(
    penaltyIds.length
      ? (
          (
            await payload.find({
              collection: "partner-penalties",
              where: { id: { in: [...new Set(penaltyIds)] } },
              pagination: false,
              depth: 0,
              select: { job: true },
              ...as,
            })
          ).docs as PartnerPenalty[]
        ).map((penalty) => [penalty.id, relId(penalty.job)])
      : [],
  );
  const penaltyBooking = (penaltyId: number | null, reference: string) => [
    { id: (penaltyId && penaltyJob.get(penaltyId)) || 0, reference },
  ];

  // The bookings behind website payments, drivers' payments, refunds and
  // penalties: their references, and where each came from.
  const websitePayments = website.docs as Payment[];
  const bookingIds = websitePayments
    .map((payment) => relId(payment.booking))
    .filter((id): id is number => id !== null);
  const lineJobIds = [
    ...(drivers.docs as DriverPayment[]).flatMap((payment) =>
      (payment.lines ?? []).map((line) => relId(line.job)),
    ),
    ...(refunds.docs as Refund[]).flatMap((refund) =>
      (refund.lines ?? []).map((line) => relId(line.job)),
    ),
    ...penaltyJob.values(),
  ].filter((id): id is number => id !== null);
  const jobs =
    bookingIds.length || lineJobIds.length
      ? ((
          await payload.find({
            collection: "jobs",
            where: {
              or: [
                ...(bookingIds.length ? [{ booking: { in: bookingIds } }] : []),
                ...(lineJobIds.length ? [{ id: { in: [...new Set(lineJobIds)] } }] : []),
              ],
            },
            sort: "pickupAt",
            pagination: false,
            depth: 0,
            ...as,
          })
        ).docs as Job[])
      : [];
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const sourceOfJob = (jobId: number | null) => {
    const job = jobId ? jobById.get(jobId) : undefined;
    if (!job) return OFFICE;
    if (job.source === "website") return WEBSITE;
    if (job.source === "supplier") return partnerSource(relId(job.supplier));
    return OFFICE;
  };
  const isTestJob = (jobId: number | null) =>
    Boolean(jobId && jobById.get(jobId)?.isTest);

  const movements: Movement[] = [];
  let feesUnknown = 0;

  for (const payment of websitePayments) {
    const booking =
      payment.booking && typeof payment.booking === "object"
        ? (payment.booking as Booking)
        : null;
    const covered = jobs
      .filter((job) => relId(job.booking) === booking?.id)
      .map((job) => ({ id: job.id, reference: job.reference }));
    const base = {
      ...at(payment.createdAt),
      record: booking?.reference ?? "Website",
      recordHref: paymentHref("website", payment.id),
      bookings: covered,
      ...WEBSITE,
    };
    movements.push({
      ...base,
      kind: "card_payment",
      detail: "Stripe",
      inPence: payment.amountPence,
      outPence: 0,
    });
    if (!payment.feeRecordedAt) feesUnknown += 1;
    else if (payment.feePence) {
      movements.push({
        ...base,
        kind: "card_fee",
        detail: "Stripe",
        inPence: 0,
        outPence: payment.feePence,
      });
    }
  }

  for (const payment of office.docs as CustomerPayment[]) {
    const base = {
      ...at(payment.paidAt),
      record: customerPaymentReference(payment.id),
      recordHref: paymentHref("office", payment.id),
      ...OFFICE,
    };
    for (const line of payment.lines ?? []) {
      movements.push({
        ...base,
        kind: "office_payment",
        bookings: [{ id: relId(line.job) ?? 0, reference: line.jobReference ?? "" }],
        detail: line.customerName ?? payment.paidBy ?? "",
        inPence: line.amountPence ?? 0,
        outPence: 0,
      });
    }
    if (payment.feePence) {
      movements.push({
        ...base,
        kind: "card_fee",
        bookings: (payment.lines ?? []).map((line) => ({
          id: relId(line.job) ?? 0,
          reference: line.jobReference ?? "",
        })),
        detail: "Card payment link",
        inPence: 0,
        outPence: payment.feePence,
      });
    }
  }

  for (const receipt of partners.docs as SupplierPayment[]) {
    const from = partnerSource(relId(receipt.supplier));
    for (const line of receipt.lines ?? []) {
      movements.push({
        ...at(receipt.receivedAt),
        kind: "partner_receipt",
        record: receiptReference(receipt.id),
        recordHref: `/admin/supplier-money/${relId(receipt.supplier)}`,
        bookings: [{ id: relId(line.job) ?? 0, reference: line.jobReference ?? "" }],
        ...from,
        detail: line.supplierReference ?? receipt.reference ?? "",
        inPence: line.amountPence ?? 0,
        outPence: 0,
      });
    }
    // The penalties the partner took off this payment (Cityline, 16 Oct 2026).
    for (const line of receipt.penalties ?? []) {
      movements.push({
        ...at(receipt.receivedAt),
        kind: "partner_penalty",
        record: receiptReference(receipt.id),
        recordHref: `/admin/supplier-money/${relId(receipt.supplier)}`,
        bookings: penaltyBooking(relId(line.penalty), line.jobReference ?? ""),
        ...from,
        detail: [line.penaltyReference, line.reason].filter(Boolean).join(" · "),
        inPence: 0,
        outPence: line.amountPence ?? 0,
      });
    }
  }

  for (const payment of drivers.docs as DriverPayment[]) {
    // Paid to a driver, or to a subcontracting operator (Cityline, 15 Oct 2026).
    const payee = payeeOfPayment(payment);
    for (const line of payment.lines ?? []) {
      const jobId = relId(line.job);
      if (isTestJob(jobId)) continue;
      const base = {
        ...at(payment.paidAt),
        record: paymentReference(payment.id),
        recordHref: payee?.payHref ?? "/admin/driver-pay",
        bookings: [{ id: jobId ?? 0, reference: line.jobReference ?? "" }],
        ...sourceOfJob(jobId),
        detail: payee?.name ?? "Driver",
      };
      if (line.pricePence) {
        movements.push({
          ...base,
          kind: "driver_pay",
          inPence: 0,
          outPence: line.pricePence,
        });
      }
      if (line.cashPence) {
        movements.push({
          ...base,
          kind: "office_cash",
          inPence: line.cashPence,
          outPence: 0,
        });
      }
    }
    // The driver's share of partner penalties, taken off what they were paid.
    for (const line of payment.penalties ?? []) {
      const penaltyId = relId(line.penalty);
      movements.push({
        ...at(payment.paidAt),
        kind: "penalty_from_driver",
        record: paymentReference(payment.id),
        recordHref: payee?.payHref ?? "/admin/driver-pay",
        bookings: penaltyBooking(penaltyId, line.jobReference ?? ""),
        ...sourceOfJob(penaltyId ? (penaltyJob.get(penaltyId) ?? null) : null),
        detail: [
          payee?.name ?? "Driver",
          line.penaltyReference ?? (penaltyId ? penaltyReference(penaltyId) : ""),
        ]
          .filter(Boolean)
          .join(" · "),
        inPence: line.amountPence ?? 0,
        outPence: 0,
      });
    }
  }

  for (const refund of refunds.docs as Refund[]) {
    const kind = relId(refund.payment) ? "website" : "office";
    const paymentId = relId(refund.payment) ?? relId(refund.customerPayment) ?? 0;
    for (const line of refund.lines ?? []) {
      const jobId = relId(line.job);
      movements.push({
        ...at(refund.refundedAt ?? refund.createdAt),
        kind: "refund",
        record: refundReference(refund.id),
        recordHref: paymentHref(kind, paymentId),
        bookings: [{ id: jobId ?? 0, reference: line.jobReference ?? "" }],
        ...sourceOfJob(jobId),
        detail: refund.reason ?? "",
        inPence: 0,
        outPence: line.amountPence ?? 0,
      });
    }
  }

  for (const expense of expenses.docs as Expense[]) {
    movements.push({
      ...at(expense.spentAt),
      kind: "expense",
      record: expenseReference(expense.id),
      recordHref: "/admin/expenses",
      bookings: [],
      ...CITYLINE,
      detail: [expense.description, expense.paidTo].filter(Boolean).join(" · "),
      inPence: 0,
      outPence: expense.amountPence,
    });
  }

  movements.sort((a, b) => b.at.localeCompare(a.at) || a.record.localeCompare(b.record));
  return { movements, feesUnknown };
}

// --- CSV --------------------------------------------------------------------

const pounds = (pence: number) => (pence ? (pence / 100).toFixed(2) : "");

/** One row per movement of money: the books' raw data. */
export const FINANCE_CSV_COLUMNS: CsvColumn<Movement>[] = [
  { header: "Date", value: (row) => row.day },
  { header: "What", value: (row) => MOVEMENT_LABELS[row.kind] },
  { header: "Record", value: (row) => row.record },
  {
    header: "Bookings",
    value: (row) => row.bookings.map((job) => job.reference).join(" "),
  },
  { header: "From", value: (row) => row.sourceLabel },
  { header: "Detail", value: (row) => row.detail },
  { header: "In (£)", value: (row) => pounds(row.inPence) },
  { header: "Out (£)", value: (row) => pounds(row.outPence) },
];

/** One row per source: website, office, each partner. */
export const FINANCE_SOURCES_CSV_COLUMNS: CsvColumn<SourceRow>[] = [
  { header: "From", value: (row) => row.label },
  { header: "In (£)", value: (row) => (row.inPence / 100).toFixed(2) },
  { header: "Refunds (£)", value: (row) => (row.refundsPence / 100).toFixed(2) },
  { header: "Card fees (£)", value: (row) => (row.feesPence / 100).toFixed(2) },
  { header: "Drivers (£)", value: (row) => (row.driversPence / 100).toFixed(2) },
  { header: "Penalties (£)", value: (row) => (row.penaltiesPence / 100).toFixed(2) },
  { header: "Left (£)", value: (row) => (row.netPence / 100).toFixed(2) },
];
