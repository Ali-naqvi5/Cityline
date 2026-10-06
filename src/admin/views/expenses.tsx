import { FileText, Undo2 } from "lucide-react";
import type { AdminViewServerProps } from "payload";

import { voidExpenseAction } from "@/admin/actions/expenses";
import { loadExpenses, spentTotal } from "@/admin/data/expenses";
import { londonDay } from "@/admin/format";
import { ExpenseForm } from "@/admin/forms/expense-form";
import { param, requireStaff } from "@/admin/guard";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { KpiTile } from "@/components/ops/charts/kpi";
import { counted } from "@/components/ops/charts/scale";
import { ConfirmDialog } from "@/components/ops/dialog";
import { FilterForm } from "@/components/ops/filter-form";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
import {
  Badge,
  buttonClass,
  Notice,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import {
  EXPENSE_METHODS,
  expenseReference,
  type ExpenseMethod,
} from "@/collections/Expenses";
import { formatPence, type Pence } from "@/domain/money";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";
import type { PrivateFile, User } from "@/payload-types";

/**
 * Expenses (approved by Cityline, 6 Oct 2026): Cityline's own costs, entered
 * by hand one by one by the Controller and Accounts — never the drivers'
 * fuel, repairs or insurance, which are theirs. Voided with a reason, never
 * edited. They come off profit on the dashboard.
 */

const money = (pence: number) => formatPence(pence as Pence);

export async function ExpensesView(props: AdminViewServerProps) {
  const context = requireStaff(props, "expenses.view", "/admin/expenses");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const [expenses, previous] = await Promise.all([
    loadExpenses(payload, user, { start: period.start, end: period.end }),
    loadExpenses(payload, user, {
      start: period.previous.start,
      end: period.previous.end,
    }),
  ]);
  const spent = spentTotal(expenses);
  const canManage = can(user.role, "expenses.manage");
  const notice = param(props.searchParams, "notice");
  const added = param(props.searchParams, "id");

  const csvQuery = new URLSearchParams();
  if (period.key === "custom") {
    csvQuery.set("from", period.from);
    csvQuery.set("to", period.to);
  } else if (period.key !== "this_month") {
    csvQuery.set("period", period.key);
  }

  return (
    <OpsShell user={user} active="expenses">
      {notice === "added" ? <Notice tone="ok">Expense added.</Notice> : null}
      {notice === "voided" ? <Notice tone="ok">Expense voided.</Notice> : null}
      <PageHeader
        title="Expenses"
        description="Cityline's own costs, entered one by one. Drivers' fuel, repairs and insurance are theirs, not Cityline's."
      />

      {canManage ? (
        <Panel title="Add an expense" className="mb-5">
          {/* A fresh form after each one added. */}
          <ExpenseForm key={added || "new"} today={londonDay(now)} />
        </Panel>
      ) : null}

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/expenses" className={FILTER_GRID}>
          <PeriodFields period={period} />
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>
      <PeriodLine period={period} basis="by the date spent" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Spent"
          value={money(spent)}
          current={spent}
          previous={spentTotal(previous)}
          unit="pence"
          better="down"
          compareName={period.previous.name}
          hint="Comes off profit on the dashboard"
        />
        <KpiTile
          label="Entries"
          value={expenses.filter((expense) => !expense.voidedAt).length}
          current={expenses.filter((expense) => !expense.voidedAt).length}
          hint={period.label}
        />
      </div>

      <Panel
        title="Expenses"
        description={`${counted(expenses.length, "entry", "entries")} · ${money(spent)}${expenses.some((expense) => expense.voidedAt) ? " (void ones not counted)" : ""}`}
        actions={
          <DownloadCsv
            href={`/api/reports/expenses${csvQuery.size ? `?${csvQuery}` : ""}`}
          />
        }
        bodyClassName="p-0"
      >
        {expenses.length === 0 ? (
          <EmptyState title="No expenses in this period" />
        ) : (
          <ul className="divide-line divide-y">
            {expenses.map((expense) => {
              const receipt =
                expense.receipt && typeof expense.receipt === "object"
                  ? (expense.receipt as PrivateFile)
                  : null;
              const enteredBy =
                expense.recordedBy && typeof expense.recordedBy === "object"
                  ? ((expense.recordedBy as User).name ??
                    (expense.recordedBy as User).email)
                  : "Staff";
              return (
                <li
                  key={expense.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          expense.voidedAt
                            ? "text-ink-3 line-through"
                            : "text-ink font-medium"
                        }
                      >
                        {expense.description}
                      </span>
                      <span className="tabular-nums">{money(expense.amountPence)}</span>
                      {expense.voidedAt ? <Badge tone="danger">Void</Badge> : null}
                    </p>
                    <p className="text-ink-3 text-xs">
                      {expenseReference(expense.id)} ·{" "}
                      {formatDate(new Date(expense.spentAt))}
                      {expense.paidTo ? ` · to ${expense.paidTo}` : ""}
                      {expense.method
                        ? ` · ${EXPENSE_METHODS[expense.method as ExpenseMethod] ?? expense.method}`
                        : ""}{" "}
                      · entered by {enteredBy}
                    </p>
                    {expense.notes ? (
                      <p className="text-ink-2 text-xs whitespace-pre-line">
                        {expense.notes}
                      </p>
                    ) : null}
                    {expense.voidedAt ? (
                      <p className="text-danger text-xs">Void: {expense.voidReason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {receipt?.url ? (
                      <a
                        href={receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonClass("secondary", "sm")}
                      >
                        <FileText aria-hidden className="h-4 w-4" />
                        Receipt
                      </a>
                    ) : null}
                    {!expense.voidedAt && canManage ? (
                      <ConfirmDialog
                        label="Void"
                        icon={<Undo2 aria-hidden className="h-4 w-4" />}
                        variant="ghost"
                        size="sm"
                        title={`Void ${expenseReference(expense.id)}?`}
                        confirmLabel="Void expense"
                        confirmVariant="danger"
                        action={voidExpenseAction}
                        fields={{ expenseId: expense.id }}
                      >
                        <p>
                          It stays on record, marked void, and stops counting. Enter it
                          again if it was only wrong.
                        </p>
                        <label
                          htmlFor={`void-expense-${expense.id}`}
                          className="text-ink-2 font-medium"
                        >
                          Why is it void?
                        </label>
                        <textarea
                          id={`void-expense-${expense.id}`}
                          name="reason"
                          rows={2}
                          required
                          className={TEXTAREA_CLASS}
                        />
                      </ConfirmDialog>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </OpsShell>
  );
}
