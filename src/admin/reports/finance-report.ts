import { addDays, mondayOf } from "@/admin/format";

import type { Period } from "./period";

/**
 * Financial Reports (approved by Cityline, 6 Oct 2026): money in and out by
 * the day it moved, as the books need it — not by pickup date, which is the
 * dashboard rings' view. Every amount is a movement of money:
 *
 *   in   card payments on the website, office bookings marked paid, money
 *        received from partners, and cash a passenger paid a driver on an
 *        office booking — counted when it is settled on the driver's payment;
 *        and a driver's share of a partner penalty, taken off their payment
 *   out  refunds, card fees, the driver's price on each booking paid for,
 *        partner penalties — counted on the payment they were taken off
 *        (Cityline, 16 Oct 2026) — and Cityline's own expenses
 *
 * Split by where the money came from: the website, the office, and each
 * partner. Cityline's own expenses belong to none of them. Pure: the screen
 * and the CSV both feed it the same movements.
 */

export type MovementKind =
  | "card_payment"
  | "office_payment"
  | "office_cash"
  | "partner_receipt"
  | "penalty_from_driver"
  | "refund"
  | "card_fee"
  | "driver_pay"
  | "partner_penalty"
  | "expense";

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  card_payment: "Card payment on the website",
  office_payment: "Office booking paid",
  office_cash: "Cash on an office booking, settled with the driver",
  partner_receipt: "Received from a partner",
  penalty_from_driver: "Penalty share, taken off a driver's payment",
  refund: "Refund",
  card_fee: "Card fee",
  driver_pay: "Driver's price, paid",
  partner_penalty: "Partner penalty, taken off their payment",
  expense: "Expense",
};

/** Cityline's own costs, which no booking source carries. */
export const CITYLINE_SOURCE = "cityline";

export interface Movement {
  /** London day the money moved, YYYY-MM-DD. */
  day: string;
  /** The instant, for ordering. */
  at: string;
  kind: MovementKind;
  /** The record it comes from: CL-…, CP-…, PR-…, DP-…, RF-…, EX-… */
  record: string;
  recordHref: string | null;
  bookings: { id: number; reference: string }[];
  /** "website", "office", "partner-<id>", or "cityline". */
  source: string;
  sourceLabel: string;
  /** Who or what: the partner, the driver, the expense. */
  detail: string;
  inPence: number;
  outPence: number;
}

export interface FinanceLines {
  cardPence: number;
  officePence: number;
  cashPence: number;
  partnerPence: number;
  penaltiesFromDriversPence: number;
  inPence: number;
  refundsPence: number;
  feesPence: number;
  driversPence: number;
  penaltiesPence: number;
  expensesPence: number;
  outPence: number;
  profitPence: number;
}

const FIELD: Record<MovementKind, keyof FinanceLines> = {
  card_payment: "cardPence",
  office_payment: "officePence",
  office_cash: "cashPence",
  partner_receipt: "partnerPence",
  penalty_from_driver: "penaltiesFromDriversPence",
  refund: "refundsPence",
  card_fee: "feesPence",
  driver_pay: "driversPence",
  partner_penalty: "penaltiesPence",
  expense: "expensesPence",
};

export function linesOf(movements: readonly Movement[]): FinanceLines {
  const lines: FinanceLines = {
    cardPence: 0,
    officePence: 0,
    cashPence: 0,
    partnerPence: 0,
    penaltiesFromDriversPence: 0,
    inPence: 0,
    refundsPence: 0,
    feesPence: 0,
    driversPence: 0,
    penaltiesPence: 0,
    expensesPence: 0,
    outPence: 0,
    profitPence: 0,
  };
  for (const movement of movements) {
    lines[FIELD[movement.kind]] += movement.inPence + movement.outPence;
    lines.inPence += movement.inPence;
    lines.outPence += movement.outPence;
  }
  lines.profitPence = lines.inPence - lines.outPence;
  return lines;
}

export interface SourceRow {
  key: string;
  label: string;
  inPence: number;
  refundsPence: number;
  feesPence: number;
  driversPence: number;
  /** Partner penalties, less the drivers' shares of them. */
  penaltiesPence: number;
  /**
   * In, less refunds, card fees, drivers and penalties: what this source left
   * Cityline.
   */
  netPence: number;
}

/**
 * Money by where it came from: the website and the office first, then each
 * partner by money in. Expenses are Cityline's own and are not shared out.
 */
export function bySource(movements: readonly Movement[]): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  for (const movement of movements) {
    if (movement.source === CITYLINE_SOURCE) continue;
    const row = rows.get(movement.source) ?? {
      key: movement.source,
      label: movement.sourceLabel,
      inPence: 0,
      refundsPence: 0,
      feesPence: 0,
      driversPence: 0,
      penaltiesPence: 0,
      netPence: 0,
    };
    // A driver's share of a penalty is counted against the penalty, not as
    // money the source brought in.
    if (movement.kind === "penalty_from_driver") row.penaltiesPence -= movement.inPence;
    else row.inPence += movement.inPence;
    if (movement.kind === "refund") row.refundsPence += movement.outPence;
    if (movement.kind === "card_fee") row.feesPence += movement.outPence;
    if (movement.kind === "driver_pay") row.driversPence += movement.outPence;
    if (movement.kind === "partner_penalty") row.penaltiesPence += movement.outPence;
    row.netPence += movement.inPence - movement.outPence;
    rows.set(movement.source, row);
  }
  const rank = (key: string) => (key === "website" ? 0 : key === "office" ? 1 : 2);
  return [...rows.values()].sort(
    (a, b) =>
      rank(a.key) - rank(b.key) ||
      b.inPence - a.inPence ||
      a.label.localeCompare(b.label),
  );
}

export type MoneyUnit = "day" | "week" | "month";

export interface MoneyBucket {
  key: string;
  label: string;
  /** For the chart's axis: "1 Oct", "28 Sept", "Oct". */
  short: string;
  lines: FinanceLines;
}

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const weekLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const monthLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

/** Days up to a month, weeks up to four months, then months. */
export function moneyUnit(days: number): MoneyUnit {
  return days <= 31 ? "day" : days <= 120 ? "week" : "month";
}

function bucketKey(day: string, unit: MoneyUnit): string {
  return unit === "day" ? day : unit === "week" ? mondayOf(day) : `${day.slice(0, 7)}-01`;
}

function nextKey(key: string, unit: MoneyUnit): string {
  if (unit === "day") return addDays(key, 1);
  if (unit === "week") return addDays(key, 7);
  const [year, month] = key.split("-").map(Number) as [number, number];
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function keyLabel(key: string, unit: MoneyUnit): { label: string; short: string } {
  const date = new Date(`${key}T12:00:00Z`);
  if (unit === "day") {
    return {
      label: dayLabel.format(date).replace(",", ""),
      short: weekLabel.format(date),
    };
  }
  if (unit === "week") {
    return { label: `w/c ${weekLabel.format(date)}`, short: weekLabel.format(date) };
  }
  return { label: monthLabel.format(date), short: monthLabel.format(date).slice(0, 3) };
}

/** The period's money, bucket by bucket, every bucket present. */
export function byBucket(
  movements: readonly Movement[],
  period: Pick<Period, "from" | "to" | "days">,
): { unit: MoneyUnit; buckets: MoneyBucket[] } {
  const unit = moneyUnit(period.days);
  const grouped = new Map<string, Movement[]>();
  for (const movement of movements) {
    const key = bucketKey(movement.day, unit);
    grouped.set(key, [...(grouped.get(key) ?? []), movement]);
  }
  const buckets: MoneyBucket[] = [];
  for (
    let key = bucketKey(period.from, unit);
    key <= period.to;
    key = nextKey(key, unit)
  ) {
    buckets.push({ key, ...keyLabel(key, unit), lines: linesOf(grouped.get(key) ?? []) });
  }
  return { unit, buckets };
}
