import "server-only";

import type { Payload, Where } from "payload";

import { relId } from "@/domain/dispatch/assignment";
import {
  awaitsPayment,
  CUSTOMER_PAYMENT_METHODS,
  customerPaymentReference,
  PAID_BY_HAND,
  priceChangedSincePaid,
  REFUND_METHODS,
  refundReference,
  stripePaymentUrl,
  takingsTotals,
  type CustomerPaymentMethod,
  type RefundMethod,
  type Takings,
} from "@/domain/finance/customer-money";
import { PAYMENT_METHOD_LABELS } from "@/domain/jobs/labels";
import type { CsvColumn } from "@/lib/csv";
import type {
  Booking,
  Customer,
  CustomerPayment,
  Job,
  Payment,
  Refund,
  User,
} from "@/payload-types";

/**
 * Loading Payments and Refunds: money in from customers — website card
 * payments from Stripe and office bookings marked paid by hand — the office
 * bookings still waiting for their money, and the refunds the office has
 * recorded. Test bookings never count. The screens and the CSVs use the same
 * rows. Owner and Accounts.
 */

type As = { user: User; overrideAccess: false };
type Range = { start: Date; end: Date };
export type PaymentKind = "website" | "office";

const NOT_TEST: Where = { isTest: { not_equals: true } };

export const paymentHref = (kind: PaymentKind, id: number) =>
  `/admin/payments/${kind}/${id}`;

const personName = (value: unknown) =>
  value && typeof value === "object"
    ? ((value as User).name ?? (value as User).email ?? null)
    : null;

const routeOf = (job: Pick<Job, "pickupAddress" | "dropoffAddress" | "hours">) =>
  `${job.pickupAddress} to ${
    job.dropoffAddress ?? (job.hours ? `hourly hire, ${job.hours} hours` : "as directed")
  }`;

const unique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].join(", ") ||
  null;

// --- Waiting for money ------------------------------------------------------

export interface AwaitingLine {
  id: number;
  reference: string;
  customer: string;
  pickupAt: string;
  route: string;
  status: string;
  paymentMethod: string;
  pricePence: number;
}

export interface PriceChanged {
  id: number;
  reference: string;
  customer: string;
  paidPence: number;
  pricePence: number;
  paymentId: number;
}

/** Office bookings paid by card link, bank transfer or on account, not paid yet. */
export async function loadAwaiting(
  payload: Payload,
  user: User,
): Promise<{ awaiting: AwaitingLine[]; changed: PriceChanged[] }> {
  const as: As = { user, overrideAccess: false };
  const [open, paid] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          NOT_TEST,
          { paymentMethod: { in: [...PAID_BY_HAND] } },
          { status: { not_equals: "cancelled" } },
          { customerPayment: { exists: false } },
        ],
      },
      sort: "pickupAt",
      pagination: false,
      depth: 1,
      ...as,
    }),
    payload.find({
      collection: "jobs",
      where: {
        and: [
          NOT_TEST,
          { customerPayment: { exists: true } },
          { status: { not_equals: "cancelled" } },
        ],
      },
      pagination: false,
      depth: 1,
      ...as,
    }),
  ]);
  const customerOf = (job: Job) =>
    (job.customer && typeof job.customer === "object"
      ? (job.customer as Customer).name
      : null) ??
    job.leadName ??
    "No customer on record";

  const awaiting = (open.docs as Job[])
    .filter((job) =>
      awaitsPayment({
        paymentMethod: job.paymentMethod,
        status: job.status,
        customerPaymentId: relId(job.customerPayment),
        isTest: job.isTest,
      }),
    )
    .map((job) => ({
      id: job.id,
      reference: job.reference,
      customer: customerOf(job),
      pickupAt: job.pickupAt,
      route: routeOf(job),
      status: job.status,
      paymentMethod: job.paymentMethod,
      pricePence: job.customerPricePence ?? 0,
    }));
  const changed = (paid.docs as Job[])
    .filter((job) =>
      priceChangedSincePaid({
        customerPaymentId: relId(job.customerPayment),
        customerPricePence: job.customerPricePence ?? null,
        customerPaidPricePence: job.customerPaidPricePence ?? null,
      }),
    )
    .map((job) => ({
      id: job.id,
      reference: job.reference,
      customer: customerOf(job),
      paidPence: job.customerPaidPricePence ?? 0,
      pricePence: job.customerPricePence ?? 0,
      paymentId: relId(job.customerPayment)!,
    }));
  return { awaiting, changed };
}

// --- Money in ---------------------------------------------------------------

export interface TakingRow {
  kind: PaymentKind;
  id: number;
  href: string;
  /** "CP-000004" for an office payment, the website booking's for a card one. */
  reference: string;
  paidAt: string;
  method: string;
  /** Stripe's payment id, or the reference the office wrote. */
  externalReference: string | null;
  bookings: { id: number; reference: string }[];
  customer: string | null;
  paidBy: string | null;
  amountPence: number;
  /** Null while Stripe has not said. */
  feePence: number | null;
  /** Refunds recorded against it so far, whenever made. */
  refundedPence: number;
  recordedBy: string | null;
  voided: boolean;
  voidReason: string | null;
}

/** Live refunds against these payments, by payment. */
async function refundedAgainst(
  payload: Payload,
  as: As,
  websiteIds: number[],
  officeIds: number[],
): Promise<{ website: Map<number, number>; office: Map<number, number> }> {
  const website = new Map<number, number>();
  const office = new Map<number, number>();
  if (!websiteIds.length && !officeIds.length) return { website, office };
  const found = await payload.find({
    collection: "refunds",
    where: {
      and: [
        { voidedAt: { exists: false } },
        {
          or: [
            ...(websiteIds.length ? [{ payment: { in: websiteIds } }] : []),
            ...(officeIds.length ? [{ customerPayment: { in: officeIds } }] : []),
          ],
        },
      ],
    },
    pagination: false,
    depth: 0,
    ...as,
  });
  for (const refund of found.docs as Refund[]) {
    const paymentId = relId(refund.payment);
    const customerPaymentId = relId(refund.customerPayment);
    if (paymentId)
      website.set(paymentId, (website.get(paymentId) ?? 0) + refund.amountPence);
    if (customerPaymentId) {
      office.set(
        customerPaymentId,
        (office.get(customerPaymentId) ?? 0) + refund.amountPence,
      );
    }
  }
  return { website, office };
}

function websiteRow(payment: Payment, jobs: Job[], refunded: number): TakingRow {
  const booking =
    payment.booking && typeof payment.booking === "object"
      ? (payment.booking as Booking)
      : null;
  const customer =
    booking?.customer && typeof booking.customer === "object"
      ? (booking.customer as Customer)
      : null;
  return {
    kind: "website",
    id: payment.id,
    href: paymentHref("website", payment.id),
    reference: booking?.reference ?? "Website",
    paidAt: payment.createdAt,
    method: "Card on the website",
    externalReference: payment.stripePaymentIntentId,
    bookings: jobs.map((job) => ({ id: job.id, reference: job.reference })),
    customer: customer?.name ?? null,
    paidBy: null,
    amountPence: payment.amountPence,
    feePence: payment.feeRecordedAt ? (payment.feePence ?? 0) : null,
    refundedPence: refunded,
    recordedBy: null,
    voided: false,
    voidReason: null,
  };
}

function officeRow(payment: CustomerPayment, refunded: number): TakingRow {
  const lines = payment.lines ?? [];
  return {
    kind: "office",
    id: payment.id,
    href: paymentHref("office", payment.id),
    reference: customerPaymentReference(payment.id),
    paidAt: payment.paidAt,
    method:
      CUSTOMER_PAYMENT_METHODS[payment.method as CustomerPaymentMethod] ?? payment.method,
    externalReference: payment.reference ?? null,
    bookings: lines.map((line) => ({
      id: relId(line.job) ?? 0,
      reference: line.jobReference ?? "",
    })),
    customer: unique(lines.map((line) => line.customerName)),
    paidBy: payment.paidBy ?? null,
    amountPence: payment.amountPence ?? 0,
    feePence: payment.feePence ?? 0,
    refundedPence: refunded,
    recordedBy: personName(payment.recordedBy),
    voided: Boolean(payment.voidedAt),
    voidReason: payment.voidReason ?? null,
  };
}

/** The bookings each website payment paid for. */
async function jobsByBooking(
  payload: Payload,
  as: As,
  bookingIds: number[],
): Promise<Map<number, Job[]>> {
  const byBooking = new Map<number, Job[]>();
  if (!bookingIds.length) return byBooking;
  const found = await payload.find({
    collection: "jobs",
    where: { booking: { in: bookingIds } },
    sort: "pickupAt",
    pagination: false,
    depth: 0,
    ...as,
  });
  for (const job of found.docs as Job[]) {
    const bookingId = relId(job.booking);
    if (bookingId) byBooking.set(bookingId, [...(byBooking.get(bookingId) ?? []), job]);
  }
  return byBooking;
}

/** Money in between two dates — by the date paid — newest first. */
export async function loadTakings(
  payload: Payload,
  user: User,
  range: Range,
): Promise<TakingRow[]> {
  const as: As = { user, overrideAccess: false };
  const [website, office] = await Promise.all([
    payload.find({
      collection: "payments",
      where: {
        and: [
          { status: { equals: "succeeded" } },
          { "booking.isTest": { not_equals: true } },
          { createdAt: { greater_than_equal: range.start.toISOString() } },
          { createdAt: { less_than: range.end.toISOString() } },
        ],
      },
      pagination: false,
      depth: 2,
      ...as,
    }),
    payload.find({
      collection: "customer-payments",
      where: {
        and: [
          { paidAt: { greater_than_equal: range.start.toISOString() } },
          { paidAt: { less_than: range.end.toISOString() } },
        ],
      },
      pagination: false,
      depth: 1,
      ...as,
    }),
  ]);
  const payments = website.docs as Payment[];
  const officePayments = office.docs as CustomerPayment[];
  const [byBooking, refunded] = await Promise.all([
    jobsByBooking(
      payload,
      as,
      payments
        .map((payment) => relId(payment.booking))
        .filter((id): id is number => !!id),
    ),
    refundedAgainst(
      payload,
      as,
      payments.map((payment) => payment.id),
      officePayments.map((payment) => payment.id),
    ),
  ]);
  return [
    ...payments.map((payment) =>
      websiteRow(
        payment,
        byBooking.get(relId(payment.booking) ?? 0) ?? [],
        refunded.website.get(payment.id) ?? 0,
      ),
    ),
    ...officePayments.map((payment) =>
      officeRow(payment, refunded.office.get(payment.id) ?? 0),
    ),
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

/** Totals for a period: money in, refunds recorded in it, and card fees. */
export function periodTakings(
  rows: readonly TakingRow[],
  refunds: readonly RefundRow[],
): Takings {
  return takingsTotals(
    rows.map((row) => ({
      amountPence: row.amountPence,
      feePence: row.feePence,
      voided: row.voided,
    })),
    refundsTotal(refunds),
  );
}

/** Website payments whose card fee is not known yet, any date. */
export async function feesMissing(payload: Payload, user: User): Promise<Payment[]> {
  const found = await payload.find({
    collection: "payments",
    where: {
      and: [
        { status: { equals: "succeeded" } },
        { "booking.isTest": { not_equals: true } },
        { feeRecordedAt: { exists: false } },
      ],
    },
    sort: "-createdAt",
    limit: 50,
    depth: 0,
    user,
    overrideAccess: false,
  });
  return found.docs as Payment[];
}

// --- Refunds ----------------------------------------------------------------

export interface RefundRow {
  id: number;
  reference: string;
  refundedAt: string;
  method: string;
  externalReference: string | null;
  reason: string;
  amountPence: number;
  bookings: { id: number; reference: string; amountPence: number }[];
  payment: { kind: PaymentKind; id: number; href: string };
  customer: string | null;
  recordedBy: string | null;
  voided: boolean;
  voidReason: string | null;
}

function refundRow(refund: Refund, customers: Map<number, string>): RefundRow {
  const paymentId = relId(refund.payment);
  const kind: PaymentKind = paymentId ? "website" : "office";
  const id = paymentId ?? relId(refund.customerPayment) ?? 0;
  const lines = refund.lines ?? [];
  return {
    id: refund.id,
    reference: refundReference(refund.id),
    refundedAt: refund.refundedAt ?? refund.createdAt,
    method: REFUND_METHODS[refund.method as RefundMethod] ?? refund.method ?? "",
    externalReference: refund.reference ?? null,
    reason: refund.reason ?? "",
    amountPence: refund.amountPence,
    bookings: lines.map((line) => ({
      id: relId(line.job) ?? 0,
      reference: line.jobReference ?? "",
      amountPence: line.amountPence ?? 0,
    })),
    payment: { kind, id, href: paymentHref(kind, id) },
    customer: unique(lines.map((line) => customers.get(relId(line.job) ?? 0))),
    recordedBy: personName(refund.createdByUser),
    voided: Boolean(refund.voidedAt),
    voidReason: refund.voidReason ?? null,
  };
}

/** Who each booking's customer is, for the refunds' lines. */
async function customersOfJobs(
  payload: Payload,
  as: As,
  jobIds: number[],
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  if (!jobIds.length) return names;
  const found = await payload.find({
    collection: "jobs",
    where: { id: { in: jobIds } },
    pagination: false,
    depth: 1,
    ...as,
  });
  for (const job of found.docs as Job[]) {
    const name =
      (job.customer && typeof job.customer === "object"
        ? (job.customer as Customer).name
        : null) ?? job.leadName;
    if (name) names.set(job.id, name);
  }
  return names;
}

async function refundRows(
  payload: Payload,
  as: As,
  refunds: Refund[],
): Promise<RefundRow[]> {
  const jobIds = [
    ...new Set(
      refunds.flatMap((refund) =>
        (refund.lines ?? [])
          .map((line) => relId(line.job))
          .filter((id): id is number => !!id),
      ),
    ),
  ];
  const customers = await customersOfJobs(payload, as, jobIds);
  return refunds.map((refund) => refundRow(refund, customers));
}

/** Refunds recorded as made between two dates — by the refund's date. */
export async function loadRefunds(
  payload: Payload,
  user: User,
  range: Range,
): Promise<RefundRow[]> {
  const as: As = { user, overrideAccess: false };
  const found = await payload.find({
    collection: "refunds",
    where: {
      and: [
        { refundedAt: { greater_than_equal: range.start.toISOString() } },
        { refundedAt: { less_than: range.end.toISOString() } },
      ],
    },
    sort: "-refundedAt",
    pagination: false,
    depth: 1,
    ...as,
  });
  return refundRows(payload, as, found.docs as Refund[]);
}

/** What went back, in total — void refunds never count. */
export function refundsTotal(refunds: readonly RefundRow[]): number {
  return refunds
    .filter((refund) => !refund.voided)
    .reduce((sum, refund) => sum + refund.amountPence, 0);
}

export interface CancelledPaid {
  id: number;
  reference: string;
  customer: string;
  cancelledAt: string;
  paidPence: number;
  paymentHref: string;
}

/**
 * Bookings cancelled between two dates that had been paid for and have no
 * refund recorded — for the office to check whether one is due.
 */
export async function loadCancelledUnrefunded(
  payload: Payload,
  user: User,
  range: Range,
): Promise<CancelledPaid[]> {
  const as: As = { user, overrideAccess: false };
  const found = await payload.find({
    collection: "jobs",
    where: {
      and: [
        NOT_TEST,
        { status: { equals: "cancelled" } },
        { cancelledAt: { greater_than_equal: range.start.toISOString() } },
        { cancelledAt: { less_than: range.end.toISOString() } },
        {
          or: [
            { paymentMethod: { equals: "web_prepaid" } },
            { customerPayment: { exists: true } },
          ],
        },
      ],
    },
    sort: "-cancelledAt",
    pagination: false,
    depth: 1,
    ...as,
  });
  const jobs = found.docs as Job[];
  if (!jobs.length) return [];
  const bookingIds = jobs
    .map((job) => relId(job.booking))
    .filter((id): id is number => !!id);
  const [payments, refunds] = await Promise.all([
    bookingIds.length
      ? payload.find({
          collection: "payments",
          where: { booking: { in: bookingIds } },
          pagination: false,
          depth: 0,
          ...as,
        })
      : Promise.resolve({ docs: [] as Payment[] }),
    payload.find({
      collection: "refunds",
      where: {
        and: [
          { voidedAt: { exists: false } },
          { "lines.job": { in: jobs.map((job) => job.id) } },
        ],
      },
      pagination: false,
      depth: 0,
      ...as,
    }),
  ]);
  const paymentOf = new Map(
    (payments.docs as Payment[]).map((payment) => [relId(payment.booking), payment.id]),
  );
  const refunded = new Set(
    (refunds.docs as Refund[]).flatMap((refund) =>
      (refund.lines ?? []).map((line) => relId(line.job)),
    ),
  );
  return jobs
    .filter((job) => !refunded.has(job.id))
    .flatMap((job) => {
      const officeId = relId(job.customerPayment);
      const websiteId = paymentOf.get(relId(job.booking));
      if (!officeId && !websiteId) return [];
      return [
        {
          id: job.id,
          reference: job.reference,
          customer:
            (job.customer && typeof job.customer === "object"
              ? (job.customer as Customer).name
              : null) ??
            job.leadName ??
            "",
          cancelledAt: job.cancelledAt ?? job.updatedAt,
          paidPence: officeId
            ? (job.customerPaidPricePence ?? job.customerPricePence ?? 0)
            : (job.customerPricePence ?? 0),
          paymentHref: officeId
            ? paymentHref("office", officeId)
            : paymentHref("website", websiteId!),
        },
      ];
    });
}

// --- One payment --------------------------------------------------------------

export interface PaymentBooking {
  id: number;
  reference: string;
  pickupAt: string;
  route: string;
  status: string;
  paidPence: number;
  refundedPence: number;
}

export interface PaymentDetail {
  row: TakingRow;
  test: boolean;
  stripeUrl: string | null;
  notes: string | null;
  voidedAt: string | null;
  customerId: number | null;
  bookings: PaymentBooking[];
  refunds: RefundRow[];
}

export async function loadPaymentDetail(
  payload: Payload,
  user: User,
  kind: PaymentKind,
  id: number,
): Promise<PaymentDetail | null> {
  const as: As = { user, overrideAccess: false };
  const refundsFound = await payload.find({
    collection: "refunds",
    where:
      kind === "website"
        ? { payment: { equals: id } }
        : { customerPayment: { equals: id } },
    sort: "-refundedAt",
    pagination: false,
    depth: 1,
    ...as,
  });
  const refunds = await refundRows(payload, as, refundsFound.docs as Refund[]);
  const refundedOn = new Map<number, number>();
  for (const refund of refunds) {
    if (refund.voided) continue;
    for (const line of refund.bookings) {
      refundedOn.set(line.id, (refundedOn.get(line.id) ?? 0) + line.amountPence);
    }
  }
  const refunded = refundsTotal(refunds);

  if (kind === "website") {
    const payment = (await payload.findByID({
      collection: "payments",
      id,
      depth: 2,
      disableErrors: true,
      ...as,
    })) as Payment | null;
    if (!payment) return null;
    const booking =
      payment.booking && typeof payment.booking === "object"
        ? (payment.booking as Booking)
        : null;
    const jobs = booking
      ? ((await jobsByBooking(payload, as, [booking.id])).get(booking.id) ?? [])
      : [];
    return {
      row: websiteRow(payment, jobs, refunded),
      test: Boolean(booking?.isTest),
      stripeUrl: stripePaymentUrl(
        payment.stripePaymentIntentId,
        Boolean(booking?.isTest),
      ),
      notes: null,
      voidedAt: null,
      customerId: relId(booking?.customer),
      bookings: jobs.map((job) => ({
        id: job.id,
        reference: job.reference,
        pickupAt: job.pickupAt,
        route: routeOf(job),
        status: job.status,
        paidPence: job.customerPricePence ?? 0,
        refundedPence: refundedOn.get(job.id) ?? 0,
      })),
      refunds,
    };
  }

  const payment = (await payload.findByID({
    collection: "customer-payments",
    id,
    depth: 1,
    disableErrors: true,
    ...as,
  })) as CustomerPayment | null;
  if (!payment) return null;
  const lines = payment.lines ?? [];
  const jobs = new Map(
    lines
      .map((line) => line.job)
      .filter((job): job is Job => Boolean(job) && typeof job === "object")
      .map((job) => [job.id, job]),
  );
  const first = jobs.values().next().value as Job | undefined;
  return {
    row: officeRow(payment, refunded),
    test: false,
    stripeUrl: null,
    notes: payment.notes ?? null,
    voidedAt: payment.voidedAt ?? null,
    customerId: relId(first?.customer),
    bookings: lines.map((line) => {
      const jobId = relId(line.job) ?? 0;
      return {
        id: jobId,
        reference: line.jobReference ?? "",
        pickupAt: line.pickupAt ?? "",
        route: line.route ?? "",
        status: jobs.get(jobId)?.status ?? "",
        paidPence: line.amountPence ?? 0,
        refundedPence: refundedOn.get(jobId) ?? 0,
      };
    }),
    refunds,
  };
}

/**
 * The payment behind a booking reference — a job's, or a website booking's —
 * for recording a refund against it.
 */
export async function paymentForReference(
  payload: Payload,
  user: User,
  reference: string,
): Promise<{ href: string } | { message: string }> {
  const as: As = { user, overrideAccess: false };
  const wanted = reference.trim().toUpperCase();
  if (!wanted) return { message: "Enter the booking's reference." };
  const [jobs, bookings] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: { reference: { equals: wanted } },
      limit: 1,
      depth: 0,
      ...as,
    }),
    payload.find({
      collection: "bookings",
      where: { reference: { equals: wanted } },
      limit: 1,
      depth: 0,
      ...as,
    }),
  ]);
  const job = jobs.docs[0] as Job | undefined;
  const officeId = job ? relId(job.customerPayment) : null;
  if (officeId) return { href: paymentHref("office", officeId) };
  const bookingId = job
    ? relId(job.booking)
    : ((bookings.docs[0] as Booking | undefined)?.id ?? null);
  if (bookingId) {
    const payments = await payload.find({
      collection: "payments",
      where: { booking: { equals: bookingId } },
      limit: 1,
      depth: 0,
      ...as,
    });
    if (payments.docs[0]) return { href: paymentHref("website", payments.docs[0].id) };
  }
  if (!job && !bookingId) return { message: `No booking ${wanted} on record.` };
  const how = job ? PAYMENT_METHOD_LABELS[job.paymentMethod] : null;
  return {
    message:
      job && (PAID_BY_HAND as readonly string[]).includes(job.paymentMethod)
        ? `${wanted} is not marked paid yet. Mark it paid on Payments first.`
        : `${wanted} has no payment here${how ? ` — it is ${how.toLowerCase()}` : ""}.`,
  };
}

// --- CSV ----------------------------------------------------------------------

const csvDay = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
        new Date(iso),
      )
    : "";
const pounds = (pence: number | null | undefined) =>
  pence === null || pence === undefined ? "" : (pence / 100).toFixed(2);

export const PAYMENTS_CSV_COLUMNS: CsvColumn<TakingRow>[] = [
  { header: "Paid", value: (row) => csvDay(row.paidAt) },
  { header: "Payment", value: (row) => row.reference },
  { header: "Kind", value: (row) => (row.kind === "website" ? "Website" : "Office") },
  { header: "How", value: (row) => row.method },
  { header: "Reference", value: (row) => row.externalReference },
  {
    header: "Bookings",
    value: (row) => row.bookings.map((job) => job.reference).join(" "),
  },
  { header: "Customer", value: (row) => row.customer },
  { header: "Paid by", value: (row) => row.paidBy },
  { header: "Amount (£)", value: (row) => pounds(row.amountPence) },
  {
    header: "Card fee (£)",
    value: (row) => (row.feePence === null ? "Not known yet" : pounds(row.feePence)),
  },
  { header: "Refunded (£)", value: (row) => pounds(row.refundedPence) },
  {
    header: "Recorded by",
    value: (row) => (row.kind === "website" ? "Stripe" : row.recordedBy),
  },
  { header: "Void", value: (row) => (row.voided ? `Yes: ${row.voidReason ?? ""}` : "") },
];

export const REFUNDS_CSV_COLUMNS: CsvColumn<RefundRow>[] = [
  { header: "Refund", value: (row) => row.reference },
  { header: "Date", value: (row) => csvDay(row.refundedAt) },
  {
    header: "Bookings",
    value: (row) =>
      row.bookings.map((job) => `${job.reference} ${pounds(job.amountPence)}`).join("; "),
  },
  { header: "Customer", value: (row) => row.customer },
  { header: "Amount (£)", value: (row) => pounds(row.amountPence) },
  { header: "How", value: (row) => row.method },
  { header: "Reference", value: (row) => row.externalReference },
  {
    header: "From",
    value: (row) =>
      row.payment.kind === "website"
        ? "Website card payment"
        : customerPaymentReference(row.payment.id),
  },
  { header: "Reason", value: (row) => row.reason },
  { header: "Recorded by", value: (row) => row.recordedBy },
  { header: "Void", value: (row) => (row.voided ? `Yes: ${row.voidReason ?? ""}` : "") },
];

// --- On a booking's page --------------------------------------------------------

export interface JobPayment {
  /** "Paid 3 Oct 2026 · CP-000004 · Bank transfer", "Waiting for payment", … */
  text: string;
  href: string | null;
  waiting: boolean;
  refundedPence: number;
}

/**
 * Whether the customer has paid for this booking, and refunds on it — for
 * the booking's Finance panel. Null for bookings paid in cash (Driver Pay)
 * or by a partner (Supplier Money).
 */
export async function loadJobPayment(
  payload: Payload,
  user: User,
  job: Pick<Job, "id" | "paymentMethod" | "status" | "booking" | "customerPayment">,
): Promise<JobPayment | null> {
  const as: As = { user, overrideAccess: false };
  const officeId = relId(job.customerPayment);
  const bookingId = relId(job.booking);
  const byHand = (PAID_BY_HAND as readonly string[]).includes(job.paymentMethod);
  if (!officeId && !byHand && job.paymentMethod !== "web_prepaid") return null;

  const [refunds, office, website] = await Promise.all([
    payload.find({
      collection: "refunds",
      where: {
        and: [{ voidedAt: { exists: false } }, { "lines.job": { equals: job.id } }],
      },
      pagination: false,
      depth: 0,
      ...as,
    }),
    officeId
      ? (payload.findByID({
          collection: "customer-payments",
          id: officeId,
          depth: 0,
          disableErrors: true,
          ...as,
        }) as Promise<CustomerPayment | null>)
      : Promise.resolve(null),
    !officeId && job.paymentMethod === "web_prepaid" && bookingId
      ? payload.find({
          collection: "payments",
          where: { booking: { equals: bookingId } },
          limit: 1,
          depth: 0,
          ...as,
        })
      : Promise.resolve(null),
  ]);
  const refundedPence = (refunds.docs as Refund[])
    .flatMap((refund) => refund.lines ?? [])
    .filter((line) => relId(line.job) === job.id)
    .reduce((sum, line) => sum + (line.amountPence ?? 0), 0);
  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));

  if (office) {
    return {
      text: `Paid ${day(office.paidAt)} · ${customerPaymentReference(office.id)} · ${
        CUSTOMER_PAYMENT_METHODS[office.method as CustomerPaymentMethod] ?? office.method
      }`,
      href: paymentHref("office", office.id),
      waiting: false,
      refundedPence,
    };
  }
  const payment = website?.docs[0] as Payment | undefined;
  if (payment) {
    return {
      text: `Card on the website, ${day(payment.createdAt)}`,
      href: paymentHref("website", payment.id),
      waiting: false,
      refundedPence,
    };
  }
  if (byHand) {
    return job.status === "cancelled"
      ? { text: "Not paid — cancelled", href: null, waiting: false, refundedPence }
      : {
          text: "Waiting for payment",
          href: "/admin/payments",
          waiting: true,
          refundedPence,
        };
  }
  return null;
}
