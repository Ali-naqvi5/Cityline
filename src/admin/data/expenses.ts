import "server-only";

import type { Payload } from "payload";

import {
  EXPENSE_METHODS,
  expenseReference,
  type ExpenseMethod,
} from "@/collections/Expenses";
import type { CsvColumn } from "@/lib/csv";
import type { Expense, User } from "@/payload-types";

/**
 * Loading Expenses: Cityline's own costs entered between two dates (by the
 * date spent), newest first, with who entered each and the receipt. The
 * screen and the CSV use the same rows.
 */
export async function loadExpenses(
  payload: Payload,
  user: User,
  range: { start: Date; end: Date },
): Promise<Expense[]> {
  const found = await payload.find({
    collection: "expenses",
    where: {
      and: [
        { spentAt: { greater_than_equal: range.start.toISOString() } },
        { spentAt: { less_than: range.end.toISOString() } },
      ],
    },
    sort: "-spentAt",
    pagination: false,
    depth: 1,
    user,
    overrideAccess: false,
  });
  return found.docs as Expense[];
}

/** What was spent in total — void entries never count. */
export function spentTotal(expenses: readonly Expense[]): number {
  return expenses
    .filter((expense) => !expense.voidedAt)
    .reduce((sum, expense) => sum + (expense.amountPence ?? 0), 0);
}

const csvDay = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
        new Date(iso),
      )
    : "";

export const EXPENSES_CSV_COLUMNS: CsvColumn<Expense>[] = [
  { header: "Expense", value: (row) => expenseReference(row.id) },
  { header: "Date", value: (row) => csvDay(row.spentAt) },
  { header: "Description", value: (row) => row.description },
  { header: "Paid to", value: (row) => row.paidTo },
  { header: "Amount (£)", value: (row) => ((row.amountPence ?? 0) / 100).toFixed(2) },
  {
    header: "How",
    value: (row) =>
      row.method ? (EXPENSE_METHODS[row.method as ExpenseMethod] ?? row.method) : "",
  },
  { header: "Receipt", value: (row) => (row.receipt ? "Yes" : "No") },
  { header: "Notes", value: (row) => row.notes },
  {
    header: "Entered by",
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
