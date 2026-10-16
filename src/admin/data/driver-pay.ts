import "server-only";

import type { Payload, Where } from "payload";

import { toPenaltyLine } from "@/admin/data/supplier-money";
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
import type { PenaltyLine } from "@/domain/finance/penalties";
import type { StatementData } from "@/domain/finance/statement-pdf";
import type { JobStatus } from "@/domain/jobs/labels";
import { licensedFromText } from "@/domain/operators/operators";
import { can } from "@/domain/staff/permissions";
import { company, formattedAddress } from "@/lib/company";
import type { CsvColumn } from "@/lib/csv";
import { openBankDetails, type BankDetails } from "@/lib/sealed";
import { statementReceipt } from "@/lib/statement-assets";
import type {
  Driver,
  DriverDocument,
  DriverPayment,
  Job,
  Operator,
  PartnerPenalty,
  PrivateFile,
  User,
} from "@/payload-types";

/**
 * Loading Driver Pay: what each driver — or subcontracting operator — is
 * owed up to a chosen day, less their share of partner penalties not yet
 * taken off (Cityline, 16 Oct 2026), the payments made, and a payment as its
 * statement. Test bookings are never paid for. Owner and Accounts.
 */

type As = { user: User; overrideAccess: false };

/**
 * Who is paid (Cityline, 15 Oct 2026): a driver, or a subcontracting operator,
 * paid the same way for the bookings they did.
 */
export interface Payee {
  kind: "driver" | "operator";
  id: number;
  name: string;
  /** How a message to them starts: a driver's first name, an operator's contact. */
  greeting: string;
  phone: string;
  whatsappConsent: boolean;
  /** Their page under Fleet, and the page where they are paid. */
  href: string;
  payHref: string;
  bankAccountLast4: string | null;
  bankDetailsSealed: string | null;
}

export const payHrefOf = (kind: Payee["kind"], id: number) =>
  kind === "operator" ? `/admin/driver-pay/operators/${id}` : `/admin/driver-pay/${id}`;

export function payeeOfDriver(driver: Driver): Payee {
  return {
    kind: "driver",
    id: driver.id,
    name: driver.fullName ?? `Driver ${driver.id}`,
    greeting: driver.firstName,
    phone: driver.phone,
    whatsappConsent: Boolean(driver.whatsappConsentAt),
    href: `/admin/drivers/${driver.id}`,
    payHref: payHrefOf("driver", driver.id),
    bankAccountLast4: driver.bankAccountLast4 ?? null,
    bankDetailsSealed: driver.bankDetailsSealed ?? null,
  };
}

export function payeeOfOperator(operator: Operator): Payee {
  return {
    kind: "operator",
    id: operator.id,
    name: operator.name,
    greeting: operator.contactName?.split(" ")[0] || operator.name,
    phone: operator.phone,
    whatsappConsent: Boolean(operator.whatsappConsentAt),
    href: `/admin/operators/${operator.id}`,
    payHref: payHrefOf("operator", operator.id),
    bankAccountLast4: operator.bankAccountLast4 ?? null,
    bankDetailsSealed: operator.bankDetailsSealed ?? null,
  };
}

/** A payment's payee, by name and page, from a payment read with depth 1. */
export function payeeOfPayment(
  payment: DriverPayment,
): { name: string; payHref: string } | null {
  if (payment.operator) {
    const operator =
      typeof payment.operator === "object" ? (payment.operator as Operator) : null;
    const id = relId(payment.operator)!;
    return {
      name: operator ? `${operator.name} (operator)` : `Operator ${id}`,
      payHref: payHrefOf("operator", id),
    };
  }
  const id = relId(payment.driver);
  if (!id) return null;
  const driver = typeof payment.driver === "object" ? (payment.driver as Driver) : null;
  return { name: driver?.fullName ?? `Driver ${id}`, payHref: payHrefOf("driver", id) };
}

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

/**
 * Partner penalties passed to a driver or operator and not yet taken off a
 * payment — for one payee, or all of them.
 */
async function openDeductions(
  payload: Payload,
  as: As,
  payee?: { kind: Payee["kind"]; id: number },
): Promise<PartnerPenalty[]> {
  const found = await payload.find({
    collection: "partner-penalties",
    where: {
      and: [
        { voidedAt: { exists: false } },
        { driverPayment: { exists: false } },
        { driverSharePence: { greater_than: 0 } },
        payee
          ? { [payee.kind]: { equals: payee.id } }
          : { or: [{ driver: { exists: true } }, { operator: { exists: true } }] },
      ],
    },
    sort: "penalisedAt",
    pagination: false,
    depth: 0,
    ...as,
  });
  return found.docs as PartnerPenalty[];
}

/** A penalty's payee key: the driver, or the operator, it is taken from. */
const penaltyPayeeKey = (penalty: PartnerPenalty) =>
  relId(penalty.driver) !== null
    ? `driver:${relId(penalty.driver)}`
    : relId(penalty.operator) !== null
      ? `operator:${relId(penalty.operator)}`
      : null;

export interface OwedRow {
  payee: Payee;
  owed: DriverOwed;
  /** The earliest unpaid booking. */
  oldest: string | null;
}

export interface ChangedAfterPaid extends PayJob {
  payee: Payee | null;
}

/** A booking's payee key: its driver, or its subcontracting operator. */
const payeeKey = (job: Job) =>
  relId(job.driver) !== null
    ? `driver:${relId(job.driver)}`
    : relId(job.operator) !== null
      ? `operator:${relId(job.operator)}`
      : null;

/**
 * Every driver and subcontracting operator with done, unpaid bookings picked
 * up before `before`.
 */
export async function loadOwed(
  payload: Payload,
  user: User,
  before: Date,
): Promise<{ rows: OwedRow[]; changed: ChangedAfterPaid[] }> {
  const as: As = { user, overrideAccess: false };
  const [unpaid, paid, drivers, operators, deductions] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          DONE,
          { isTest: { not_equals: true } },
          { or: [{ driver: { exists: true } }, { operator: { exists: true } }] },
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
    payload.find({ collection: "operators", pagination: false, depth: 0, ...as }),
    openDeductions(payload, as),
  ]);

  const payees = new Map<string, Payee>([
    ...(drivers.docs as Driver[]).map(
      (driver) => [`driver:${driver.id}`, payeeOfDriver(driver)] as const,
    ),
    ...(operators.docs as Operator[]).map(
      (operator) => [`operator:${operator.id}`, payeeOfOperator(operator)] as const,
    ),
  ]);
  const byPayee = new Map<string, PayJob[]>();
  for (const job of unpaid.docs as Job[]) {
    const key = payeeKey(job);
    if (key === null) continue;
    byPayee.set(key, [...(byPayee.get(key) ?? []), toPayJob(job)]);
  }
  const deductedFrom = new Map<string, PenaltyLine[]>();
  for (const penalty of deductions) {
    const key = penaltyPayeeKey(penalty);
    if (key === null) continue;
    deductedFrom.set(key, [...(deductedFrom.get(key) ?? []), toPenaltyLine(penalty)]);
    if (!byPayee.has(key)) byPayee.set(key, []);
  }
  const rows: OwedRow[] = [...byPayee.entries()]
    .filter(([key]) => payees.has(key))
    .map(([key, jobs]) => ({
      payee: payees.get(key)!,
      owed: owedUpTo(jobs, before, deductedFrom.get(key) ?? []),
      oldest: jobs[0]?.pickupAt ?? null,
    }))
    .filter(
      (row) =>
        row.owed.payable.length ||
        row.owed.missingPrice.length ||
        row.owed.penalties.length,
    )
    .sort(
      (a, b) =>
        b.owed.netPence - a.owed.netPence || a.payee.name.localeCompare(b.payee.name),
    );

  const changed = (paid.docs as Job[])
    .map((job) => {
      const key = payeeKey(job);
      return { ...toPayJob(job), payee: key ? (payees.get(key) ?? null) : null };
    })
    .filter(priceChangedSincePaid);

  return { rows, changed };
}

/** Payments made between `start` and `end`, newest first. */
export async function loadPayments(
  payload: Payload,
  user: User,
  range: { start: Date; end: Date },
  payee?: { kind: Payee["kind"]; id: number },
): Promise<DriverPayment[]> {
  const found = await payload.find({
    collection: "driver-payments",
    where: {
      and: [
        { paidAt: { greater_than_equal: range.start.toISOString() } },
        { paidAt: { less_than: range.end.toISOString() } },
        ...(payee ? [{ [payee.kind]: { equals: payee.id } }] : []),
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

/**
 * The first day a payment covers (Cityline, 14 Oct 2026). Kept on the
 * payment when it is recorded; one made before then starts at its first
 * booking.
 */
export function periodFromOf(
  payment: Pick<DriverPayment, "periodFrom" | "lines" | "upTo">,
): Date {
  return new Date(payment.periodFrom ?? payment.lines?.[0]?.pickupAt ?? payment.upTo);
}

/** What was paid in total — voided payments never count. */
export function paidTotal(payments: readonly DriverPayment[]): number {
  return payments
    .filter((payment) => !payment.voidedAt)
    .reduce((sum, payment) => sum + (payment.amountPence ?? 0), 0);
}

export interface DriverPayData {
  payee: Payee;
  bank: BankDetails | null;
  canSeeBank: boolean;
  owed: DriverOwed;
  payments: DriverPayment[];
}

/** One driver's — or subcontracting operator's — pay: owed, and paid. */
export async function loadDriverPay(
  payload: Payload,
  user: User,
  who: { kind: Payee["kind"]; id: number },
  before: Date,
): Promise<DriverPayData | null> {
  const as: As = { user, overrideAccess: false };
  const record =
    who.kind === "operator"
      ? ((await payload.findByID({
          collection: "operators",
          id: who.id,
          depth: 0,
          disableErrors: true,
          ...as,
        })) as Operator | null)
      : ((await payload.findByID({
          collection: "drivers",
          id: who.id,
          depth: 0,
          disableErrors: true,
          ...as,
        })) as Driver | null);
  if (!record) return null;
  const payee =
    who.kind === "operator"
      ? payeeOfOperator(record as Operator)
      : payeeOfDriver(record as Driver);

  const [unpaid, payments, deductions] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [
          DONE,
          { isTest: { not_equals: true } },
          { [who.kind]: { equals: who.id } },
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
      where: { [who.kind]: { equals: who.id } },
      sort: "-paidAt",
      pagination: false,
      depth: 1,
      ...as,
    }),
    openDeductions(payload, as, who),
  ]);

  const canSeeBank = can(user.role, "drivers.bankDetails");
  return {
    payee,
    bank: canSeeBank ? openBankDetails(payee.bankDetailsSealed) : null,
    canSeeBank,
    owed: owedUpTo(
      (unpaid.docs as Job[]).map(toPayJob),
      before,
      deductions.map(toPenaltyLine),
    ),
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
  const operatorId = relId(payment.operator);
  const operator = operatorId
    ? ((await payload.findByID({
        collection: "operators",
        id: operatorId,
        depth: 0,
        disableErrors: true,
        overrideAccess: true,
      })) as Operator | null)
    : null;
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
  // Each booking's pickup and drop-off, for the statement's own columns.
  const jobIds = (payment.lines ?? [])
    .map((line) => relId(line.job))
    .filter((id): id is number => id !== null);
  const jobs = jobIds.length
    ? await payload.find({
        collection: "jobs",
        where: { id: { in: jobIds } },
        pagination: false,
        depth: 0,
        select: { pickupAddress: true, dropoffAddress: true, hours: true },
        overrideAccess: true,
      })
    : { docs: [] };
  const jobById = new Map((jobs.docs as Job[]).map((job) => [job.id, job]));
  // The bank transfer receipt, if one was added, for the last page.
  const receiptId = relId(payment.receipt);
  const receiptFile = receiptId
    ? ((await payload.findByID({
        collection: "private-files",
        id: receiptId,
        depth: 0,
        disableErrors: true,
        overrideAccess: true,
      })) as PrivateFile | null)
    : null;
  // Paid to a driver, or to a subcontracting operator (Cityline, 15 Oct 2026).
  const payee = operator
    ? payeeOfOperator(operator)
    : driver
      ? payeeOfDriver(driver)
      : null;
  // A bank transfer shows the payee's account: the holder, the sort code in
  // full, and the account number's last four digits only (Cityline, 13 Oct 2026).
  const account =
    payment.method === "bank_transfer" && payee?.bankAccountLast4
      ? openBankDetails(payee.bankDetailsSealed)
      : null;
  const bank =
    payment.method === "bank_transfer" && payee?.bankAccountLast4
      ? {
          holder: account?.accountName || payee.name,
          sortCode: account?.sortCode ?? null,
          last4: payee.bankAccountLast4,
        }
      : null;
  const phvNumber = licence?.number ?? driver?.phvLicenceNumber ?? null;

  return {
    reference: paymentReference(payment.id),
    paidAt: new Date(payment.paidAt),
    periodFrom: periodFromOf(payment),
    upTo: new Date(payment.upTo),
    method: PAYMENT_METHODS[payment.method as PaymentMethod] ?? payment.method,
    bankReference: payment.reference ?? null,
    voided: Boolean(payment.voidedAt),
    driverName: payee?.name ?? "Driver",
    // Under the name: a driver's PHV licence, or the operator's licence.
    licence: operator
      ? [
          operator.licenceNumber ? `Operator licence ${operator.licenceNumber}` : null,
          licensedFromText(operator),
        ]
          .filter(Boolean)
          .join(" · ")
      : phvNumber
        ? `PHV licence ${phvNumber}`
        : null,
    bank,
    lines: (payment.lines ?? []).map((line) => {
      const job = jobById.get(relId(line.job) ?? 0);
      // A booking no longer on record falls back to the route as paid.
      const [routeFrom, routeTo] = (line.route ?? "").split(" to ");
      return {
        pickupAt: new Date(line.pickupAt ?? payment.upTo),
        reference: line.jobReference ?? "",
        pickup: job?.pickupAddress ?? routeFrom ?? "",
        dropoff: job
          ? (job.dropoffAddress ??
            (job.hours ? `Hourly hire, ${job.hours} hours` : "As directed"))
          : (routeTo ?? ""),
        // The short names, which fit the statement's column.
        status: line.status === "no_show" ? "PNS" : "Completed",
        pricePence: line.pricePence ?? 0,
        cashPence: line.cashPence ?? 0,
      };
    }),
    earnedPence: payment.earnedPence ?? 0,
    cashPence: payment.cashPence ?? 0,
    penalties: (payment.penalties ?? []).map((line) => ({
      penalisedAt: new Date(line.penalisedAt ?? payment.paidAt),
      reference: line.jobReference ?? "",
      reason: line.reason ?? "",
      amountPence: line.amountPence ?? 0,
    })),
    penaltiesPence: payment.penaltiesPence ?? 0,
    amountPence: payment.amountPence ?? 0,
    company: {
      name: company.tradingName,
      address: formattedAddress(),
      phone: company.phone,
      email: company.email,
    },
    generatedAt: now,
    receipt: receiptFile?.filename ? await statementReceipt(receiptFile.filename) : null,
  };
}

const csvDay = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
        new Date(iso),
      )
    : "";
const pounds = (pence: number | null | undefined) => ((pence ?? 0) / 100).toFixed(2);

/** One row per payment to a driver or subcontracting operator, for accounts. */
export const DRIVER_PAYMENTS_CSV_COLUMNS: CsvColumn<DriverPayment>[] = [
  { header: "Payment", value: (row) => paymentReference(row.id) },
  { header: "Date paid", value: (row) => csvDay(row.paidAt) },
  { header: "Driver", value: (row) => payeeOfPayment(row)?.name ?? "" },
  { header: "Covers from", value: (row) => csvDay(periodFromOf(row).toISOString()) },
  { header: "Covers to", value: (row) => csvDay(row.upTo) },
  { header: "Bookings", value: (row) => row.lines?.length ?? 0 },
  { header: "Driver prices (£)", value: (row) => pounds(row.earnedPence) },
  { header: "Cash collected by driver (£)", value: (row) => pounds(row.cashPence) },
  { header: "Penalties taken off (£)", value: (row) => pounds(row.penaltiesPence) },
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
