import "server-only";

import type { Payload, Where } from "payload";

import { currentDocument } from "@/domain/compliance/documents";
import { relId } from "@/domain/dispatch/assignment";
import {
  owedUpTo,
  PAYMENT_METHODS,
  paymentReference,
  priceChangedSincePaid,
  type DriverOwed,
  type PayJob,
  type PaymentMethod,
} from "@/domain/finance/driver-pay";
import type { StatementData } from "@/domain/finance/statement-pdf";
import type { JobStatus } from "@/domain/jobs/labels";
import { can } from "@/domain/staff/permissions";
import { company, formattedAddress } from "@/lib/company";
import type { CsvColumn } from "@/lib/csv";
import { openBankDetails, type BankDetails } from "@/lib/sealed";
import type { Driver, DriverDocument, DriverPayment, Job, User } from "@/payload-types";

/**
 * Loading Driver Pay: what each driver is owed up to a chosen day, the
 * payments made, and a payment as its statement. Test bookings are never
 * paid for. Owner and Accounts.
 */

type As = { user: User; overrideAccess: false };

export function toPayJob(job: Job): PayJob {
  return {
    id: job.id,
    reference: job.reference,
    status: job.status as JobStatus,
    pickupAt: job.pickupAt,
    pickupAddress: job.pickupAddress,
    dropoffAddress: job.dropoffAddress ?? null,
    hours: job.hours ?? null,
    driverPricePence: job.driverPricePence ?? null,
    paymentMethod: job.paymentMethod,
    customerPricePence: job.customerPricePence ?? null,
    driverPaymentId: relId(job.driverPayment),
    driverPaidPricePence: job.driverPaidPricePence ?? null,
  };
}

const DONE: Where = { status: { in: ["completed", "no_show"] } };

export interface OwedRow {
  driver: Driver;
  owed: DriverOwed;
  /** The earliest unpaid booking. */
  oldest: string | null;
}

export interface ChangedAfterPaid extends PayJob {
  driverId: number | null;
}

/** Every driver with done, unpaid bookings picked up before `before`. */
export async function loadOwed(
  payload: Payload,
  user: User,
  before: Date,
): Promise<{ rows: OwedRow[]; changed: ChangedAfterPaid[] }> {
  const as: As = { user, overrideAccess: false };
  const [unpaid, paid, drivers] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          DONE,
          { isTest: { not_equals: true } },
          { driver: { exists: true } },
          { driverPayment: { exists: false } },
          { pickupAt: { less_than: before.toISOString() } },
        ],
      },
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({
      collection: "jobs",
      where: {
        and: [{ driverPayment: { exists: true } }, { isTest: { not_equals: true } }],
      },
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({ collection: "drivers", pagination: false, depth: 0, ...as }),
  ]);

  const byDriver = new Map<number, PayJob[]>();
  for (const job of unpaid.docs as Job[]) {
    const driverId = relId(job.driver);
    if (driverId === null) continue;
    byDriver.set(driverId, [...(byDriver.get(driverId) ?? []), toPayJob(job)]);
  }
  const driverById = new Map(
    (drivers.docs as Driver[]).map((driver) => [driver.id, driver]),
  );
  const rows: OwedRow[] = [...byDriver.entries()]
    .filter(([driverId]) => driverById.has(driverId))
    .map(([driverId, jobs]) => ({
      driver: driverById.get(driverId)!,
      owed: owedUpTo(jobs, before),
      oldest: jobs[0]?.pickupAt ?? null,
    }))
    .sort(
      (a, b) =>
        b.owed.netPence - a.owed.netPence ||
        (a.driver.fullName ?? "").localeCompare(b.driver.fullName ?? ""),
    );

  const changed = (paid.docs as Job[])
    .map((job) => ({ ...toPayJob(job), driverId: relId(job.driver) }))
    .filter(priceChangedSincePaid);

  return { rows, changed };
}

/** Payments made between `start` and `end`, newest first. */
export async function loadPayments(
  payload: Payload,
  user: User,
  range: { start: Date; end: Date },
  driverId?: number,
): Promise<DriverPayment[]> {
  const found = await payload.find({
    collection: "driver-payments",
    where: {
      and: [
        { paidAt: { greater_than_equal: range.start.toISOString() } },
        { paidAt: { less_than: range.end.toISOString() } },
        ...(driverId ? [{ driver: { equals: driverId } }] : []),
      ],
    },
    sort: "-paidAt",
    pagination: false,
    // Who recorded each, by name, where the person asking may see staff.
    depth: 1,
    user,
    overrideAccess: false,
  });
  return found.docs as DriverPayment[];
}

/** What was paid in total — voided payments never count. */
export function paidTotal(payments: readonly DriverPayment[]): number {
  return payments
    .filter((payment) => !payment.voidedAt)
    .reduce((sum, payment) => sum + (payment.amountPence ?? 0), 0);
}

export interface DriverPayData {
  driver: Driver;
  bank: BankDetails | null;
  canSeeBank: boolean;
  owed: DriverOwed;
  payments: DriverPayment[];
}

export async function loadDriverPay(
  payload: Payload,
  user: User,
  driverId: number,
  before: Date,
): Promise<DriverPayData | null> {
  const as: As = { user, overrideAccess: false };
  const driver = (await payload.findByID({
    collection: "drivers",
    id: driverId,
    depth: 0,
    disableErrors: true,
    ...as,
  })) as Driver | null;
  if (!driver) return null;

  const [unpaid, payments] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          DONE,
          { isTest: { not_equals: true } },
          { driver: { equals: driverId } },
          { driverPayment: { exists: false } },
          { pickupAt: { less_than: before.toISOString() } },
        ],
      },
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({
      collection: "driver-payments",
      where: { driver: { equals: driverId } },
      sort: "-paidAt",
      pagination: false,
      depth: 1,
      ...as,
    }),
  ]);

  const canSeeBank = can(user.role, "drivers.bankDetails");
  return {
    driver,
    bank: canSeeBank ? openBankDetails(driver.bankDetailsSealed) : null,
    canSeeBank,
    owed: owedUpTo((unpaid.docs as Job[]).map(toPayJob), before),
    payments: payments.docs as DriverPayment[],
  };
}

/**
 * A payment as its statement. `as` is the member of staff asking; a driver
 * opening their own link has none, and the link itself is the permission.
 */
export async function statementFor(
  payload: Payload,
  paymentId: number,
  as: As | { overrideAccess: true },
  now: Date,
): Promise<StatementData | null> {
  const payment = (await payload.findByID({
    collection: "driver-payments",
    id: paymentId,
    depth: 0,
    disableErrors: true,
    ...as,
  })) as DriverPayment | null;
  if (!payment) return null;
  const driverId = relId(payment.driver);
  const [driver, documents] = await Promise.all([
    driverId
      ? (payload.findByID({
          collection: "drivers",
          id: driverId,
          depth: 0,
          disableErrors: true,
          overrideAccess: true,
        }) as Promise<Driver | null>)
      : null,
    driverId
      ? payload.find({
          collection: "driver-documents",
          where: {
            and: [{ driver: { equals: driverId } }, { type: { equals: "phv_licence" } }],
          },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] },
  ]);
  const licence = currentDocument(documents.docs as DriverDocument[], "phv_licence");

  return {
    reference: paymentReference(payment.id),
    paidAt: new Date(payment.paidAt),
    upTo: new Date(payment.upTo),
    method: PAYMENT_METHODS[payment.method as PaymentMethod] ?? payment.method,
    bankReference: payment.reference ?? null,
    voided: Boolean(payment.voidedAt),
    driverName: driver?.fullName ?? "Driver",
    phvNumber: licence?.number ?? null,
    lines: (payment.lines ?? []).map((line) => ({
      pickupAt: new Date(line.pickupAt ?? payment.upTo),
      reference: line.jobReference ?? "",
      route: line.route ?? "",
      // The short names, which fit the statement's column.
      status: line.status === "no_show" ? "PNS" : "Completed",
      pricePence: line.pricePence ?? 0,
      cashPence: line.cashPence ?? 0,
    })),
    earnedPence: payment.earnedPence ?? 0,
    cashPence: payment.cashPence ?? 0,
    amountPence: payment.amountPence ?? 0,
    company: {
      name: company.tradingName,
      address: formattedAddress(),
      phone: company.phone,
      email: company.email,
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

/** One row per payment to a driver, for accounts. */
export const DRIVER_PAYMENTS_CSV_COLUMNS: CsvColumn<DriverPayment>[] = [
  { header: "Payment", value: (row) => paymentReference(row.id) },
  { header: "Date paid", value: (row) => csvDay(row.paidAt) },
  {
    header: "Driver",
    value: (row) =>
      row.driver && typeof row.driver === "object"
        ? ((row.driver as Driver).fullName ?? "")
        : String(relId(row.driver) ?? ""),
  },
  { header: "Bookings up to", value: (row) => csvDay(row.upTo) },
  { header: "Bookings", value: (row) => row.lines?.length ?? 0 },
  { header: "Driver prices (£)", value: (row) => pounds(row.earnedPence) },
  { header: "Cash collected by driver (£)", value: (row) => pounds(row.cashPence) },
  { header: "Paid (£)", value: (row) => pounds(row.amountPence) },
  {
    header: "Method",
    value: (row) => PAYMENT_METHODS[row.method as PaymentMethod] ?? row.method,
  },
  { header: "Bank reference", value: (row) => row.reference },
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
