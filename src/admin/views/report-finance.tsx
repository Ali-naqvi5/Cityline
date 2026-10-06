import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { requireStaff } from "@/admin/guard";
import { loadFinanceMovements } from "@/admin/reports/finance-data";
import {
  byBucket,
  bySource,
  linesOf,
  MOVEMENT_LABELS,
  type FinanceLines,
} from "@/admin/reports/finance-report";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { KpiTile } from "@/components/ops/charts/kpi";
import { MoneyColumns } from "@/components/ops/charts/money-columns";
import { counted } from "@/components/ops/charts/scale";
import { TipLayer } from "@/components/ops/charts/tip-layer";
import { FilterForm } from "@/components/ops/filter-form";
import { buttonClass, cx, Notice, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { formatPence, type Pence } from "@/domain/money";
import { formatDate } from "@/lib/time";

/**
 * Financial Reports (approved by Cityline, 6 Oct 2026): money in and out by
 * the day it moved, for the books — split by the website, the office and
 * each partner, with every movement as a row and as a CSV. Owner and
 * Accounts.
 */

const TH = "px-3 py-2 text-left font-semibold whitespace-nowrap";
const TH_NUM = "px-3 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";
const TD_NUM = "px-3 py-2 text-right whitespace-nowrap tabular-nums";
const money = (pence: number) => formatPence(pence as Pence);
const less = (pence: number) => (pence ? `− ${money(pence)}` : "—");

/** The statement's lines, in order. */
const STATEMENT: {
  label: string;
  field: keyof FinanceLines;
  kind: "in" | "out" | "total" | "profit";
}[] = [
  { label: "Card payments on the website", field: "cardPence", kind: "in" },
  { label: "Office bookings paid", field: "officePence", kind: "in" },
  {
    label: "Cash on office bookings, settled with drivers",
    field: "cashPence",
    kind: "in",
  },
  { label: "From partners", field: "partnerPence", kind: "in" },
  { label: "Money in", field: "inPence", kind: "total" },
  { label: "Refunds", field: "refundsPence", kind: "out" },
  { label: "Card fees", field: "feesPence", kind: "out" },
  { label: "Drivers' prices, paid", field: "driversPence", kind: "out" },
  { label: "Cityline's own expenses", field: "expensesPence", kind: "out" },
  { label: "Money out", field: "outPence", kind: "total" },
  { label: "Profit", field: "profitPence", kind: "profit" },
];

export async function FinanceReportView(props: AdminViewServerProps) {
  const context = requireStaff(props, "reports.financial", "/admin/reports/finance");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const [current, previous] = await Promise.all([
    loadFinanceMovements(payload, user, { start: period.start, end: period.end }),
    loadFinanceMovements(payload, user, {
      start: period.previous.start,
      end: period.previous.end,
    }),
  ]);
  const { movements, feesUnknown } = current;
  const lines = linesOf(movements);
  const before = linesOf(previous.movements);
  const sources = bySource(movements);
  const series = byBucket(movements, period);

  const query = new URLSearchParams();
  if (period.key === "custom") {
    query.set("from", period.from);
    query.set("to", period.to);
  } else if (period.key !== "this_month") {
    query.set("period", period.key);
  }
  const csvHref = (data?: string) => {
    const csv = new URLSearchParams(query);
    if (data) csv.set("data", data);
    return `/api/reports/finance${csv.size ? `?${csv}` : ""}`;
  };
  const unitName =
    series.unit === "day" ? "day" : series.unit === "week" ? "week" : "month";

  return (
    <OpsShell user={user} active="financial-reports">
      <PageHeader
        title="Financial Reports"
        description="Money in and out on the day it moved, for the books. Money owed but not yet paid — to drivers, or by partners and customers — is on Driver Pay, Supplier Money and Payments."
        actions={<DownloadCsv href={csvHref()} />}
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/reports/finance" className={FILTER_GRID}>
          <PeriodFields period={period} />
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>
      <PeriodLine period={period} basis="by the day the money moved" />

      {feesUnknown ? (
        <Notice tone="warn">
          {counted(feesUnknown, "website payment")} in these dates{" "}
          {feesUnknown === 1 ? "has" : "have"} no card fee from Stripe yet, so profit is a
          little high.{" "}
          <Link href="/admin/payments" className="underline">
            Get the fees on Payments
          </Link>
          .
        </Notice>
      ) : null}

      <TipLayer className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiTile
            label="Money in"
            value={money(lines.inPence)}
            current={lines.inPence}
            previous={before.inPence}
            unit="pence"
            compareName={period.previous.name}
          />
          <KpiTile
            label="Refunds and card fees"
            value={money(lines.refundsPence + lines.feesPence)}
            current={lines.refundsPence + lines.feesPence}
            previous={before.refundsPence + before.feesPence}
            unit="pence"
            better="down"
            compareName={period.previous.name}
          />
          <KpiTile
            label="Paid to drivers"
            value={money(lines.driversPence)}
            current={lines.driversPence}
            previous={before.driversPence}
            unit="pence"
            better="none"
            compareName={period.previous.name}
            hint="Their price on each booking settled"
          />
          <KpiTile
            label="Expenses"
            value={money(lines.expensesPence)}
            current={lines.expensesPence}
            previous={before.expensesPence}
            unit="pence"
            better="down"
            compareName={period.previous.name}
          />
          <KpiTile
            label={lines.profitPence < 0 ? "Loss" : "Profit"}
            value={money(lines.profitPence)}
            current={lines.profitPence}
            previous={before.profitPence}
            unit="pence"
            compareName={period.previous.name}
            tone={lines.profitPence < 0 ? "danger" : undefined}
            hint="Money in less money out"
          />
        </div>

        {movements.length === 0 ? (
          <Panel>
            <EmptyState
              title="No money moved in this period"
              description="Try a longer period."
            />
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel
                title={`Profit per ${unitName}`}
                description={`${series.unit === "week" ? "Weeks start on Monday. " : ""}A loss hangs below the line. Hover a column for its money in and out.`}
              >
                <MoneyColumns
                  points={series.buckets.map((bucket) => ({
                    key: bucket.key,
                    label: bucket.label,
                    short: bucket.short,
                    value: bucket.lines.profitPence,
                    tip: `${bucket.label} · ${money(bucket.lines.inPence)} in, ${money(bucket.lines.outPence)} out`,
                  }))}
                />
                <details className="mt-3">
                  <summary className="text-accent cursor-pointer text-sm">
                    Show the numbers
                  </summary>
                  <div className="relative mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-ink-3 text-xs">
                        <tr>
                          <th className="py-1 pr-4 text-left font-medium capitalize">
                            {unitName}
                          </th>
                          <th className="py-1 pr-4 text-right font-medium">In</th>
                          <th className="py-1 pr-4 text-right font-medium">Refunds</th>
                          <th className="py-1 pr-4 text-right font-medium">Card fees</th>
                          <th className="py-1 pr-4 text-right font-medium">Drivers</th>
                          <th className="py-1 pr-4 text-right font-medium">Expenses</th>
                          <th className="py-1 text-right font-medium">Profit</th>
                        </tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {series.buckets.map((bucket) => (
                          <tr key={bucket.key} className="border-line border-t">
                            <td className="py-1 pr-4 whitespace-nowrap">
                              {bucket.label}
                            </td>
                            <td className="py-1 pr-4 text-right">
                              {money(bucket.lines.inPence)}
                            </td>
                            <td className="py-1 pr-4 text-right">
                              {money(bucket.lines.refundsPence)}
                            </td>
                            <td className="py-1 pr-4 text-right">
                              {money(bucket.lines.feesPence)}
                            </td>
                            <td className="py-1 pr-4 text-right">
                              {money(bucket.lines.driversPence)}
                            </td>
                            <td className="py-1 pr-4 text-right">
                              {money(bucket.lines.expensesPence)}
                            </td>
                            <td
                              className={cx(
                                "py-1 text-right",
                                bucket.lines.profitPence < 0 && "text-danger",
                              )}
                            >
                              {money(bucket.lines.profitPence)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Panel>

              <Panel
                title="Money in and out"
                description={`Beside: ${period.previous.label}`}
                bodyClassName="p-0"
              >
                <table className="w-full text-sm">
                  <thead className="bg-sunken text-ink-3 text-xs">
                    <tr>
                      <th scope="col" className={TH}>
                        <span className="sr-only">Line</span>
                      </th>
                      <th scope="col" className={TH_NUM}>
                        These dates
                      </th>
                      <th scope="col" className={TH_NUM}>
                        Before
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATEMENT.map((line) => {
                      const value = lines[line.field];
                      const was = before[line.field];
                      const strong = line.kind === "total" || line.kind === "profit";
                      return (
                        <tr
                          key={line.field}
                          className={cx(
                            "border-line border-t",
                            strong && "bg-sunken/50 font-semibold",
                          )}
                        >
                          <th
                            scope="row"
                            className={cx(
                              "px-3 py-2 text-left font-normal",
                              strong ? "text-ink font-semibold" : "text-ink-2",
                              line.kind === "in" || line.kind === "out" ? "pl-6" : "",
                            )}
                          >
                            {line.label}
                          </th>
                          <td
                            className={cx(
                              TD_NUM,
                              line.kind === "profit" && value < 0 && "text-danger",
                            )}
                          >
                            {line.kind === "out" ? less(value) : money(value)}
                          </td>
                          <td className={cx(TD_NUM, "text-ink-3")}>
                            {line.kind === "out" ? less(was) : money(was)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            </div>

            <Panel
              title="By where the money came from"
              description="What each brought in, less its refunds, card fees and drivers. Cityline's own expenses are not shared out."
              actions={<DownloadCsv href={csvHref("sources")} />}
              bodyClassName="p-0"
            >
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sunken text-ink-3 text-xs">
                    <tr>
                      <th scope="col" className={TH}>
                        From
                      </th>
                      <th scope="col" className={TH_NUM}>
                        In
                      </th>
                      <th scope="col" className={TH_NUM}>
                        Refunds
                      </th>
                      <th scope="col" className={TH_NUM}>
                        Card fees
                      </th>
                      <th scope="col" className={TH_NUM}>
                        Drivers
                      </th>
                      <th scope="col" className={TH_NUM}>
                        Left
                      </th>
                      <th scope="col" className={TH_NUM}>
                        Share of money in
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((row) => (
                      <tr key={row.key} className="border-line border-t">
                        <th
                          scope="row"
                          className={cx(TD, "text-ink text-left font-medium")}
                        >
                          {row.label}
                        </th>
                        <td className={TD_NUM}>{money(row.inPence)}</td>
                        <td className={TD_NUM}>{less(row.refundsPence)}</td>
                        <td className={TD_NUM}>{less(row.feesPence)}</td>
                        <td className={TD_NUM}>{less(row.driversPence)}</td>
                        <td
                          className={cx(
                            TD_NUM,
                            "font-semibold",
                            row.netPence < 0 && "text-danger",
                          )}
                        >
                          {money(row.netPence)}
                        </td>
                        <td className={TD_NUM}>
                          {lines.inPence > 0
                            ? `${Math.round((row.inPence / lines.inPence) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-line border-t">
                      <th
                        scope="row"
                        className={cx(TD, "text-ink-2 text-left font-normal")}
                      >
                        Cityline&apos;s own expenses
                      </th>
                      <td className={TD_NUM} colSpan={4} />
                      <td className={TD_NUM}>{less(lines.expensesPence)}</td>
                      <td className={TD_NUM} />
                    </tr>
                    <tr className="border-line bg-sunken/50 border-t font-semibold">
                      <th scope="row" className={cx(TD, "text-ink text-left")}>
                        {lines.profitPence < 0 ? "Loss" : "Profit"}
                      </th>
                      <td className={TD_NUM} colSpan={4} />
                      <td className={cx(TD_NUM, lines.profitPence < 0 && "text-danger")}>
                        {money(lines.profitPence)}
                      </td>
                      <td className={TD_NUM} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </TipLayer>

      {movements.length ? (
        <Panel
          title="Every movement of money"
          description={`${counted(movements.length, "line")}, newest first. A payment covering several bookings has a line for each.`}
          actions={<DownloadCsv href={csvHref()} />}
          className="mt-5"
          bodyClassName="p-0"
        >
          <div className="relative max-h-[640px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 sticky top-0 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Date
                  </th>
                  <th scope="col" className={TH}>
                    What
                  </th>
                  <th scope="col" className={TH}>
                    Record
                  </th>
                  <th scope="col" className={TH}>
                    Bookings
                  </th>
                  <th scope="col" className={TH}>
                    From
                  </th>
                  <th scope="col" className={TH}>
                    Detail
                  </th>
                  <th scope="col" className={TH_NUM}>
                    In
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Out
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement, index) => (
                  <tr
                    key={`${movement.record}-${movement.kind}-${index}`}
                    className="border-line border-t"
                  >
                    <td className={`${TD} tabular-nums`}>
                      {formatDate(new Date(`${movement.day}T12:00:00Z`))}
                    </td>
                    <td className="min-w-[160px] px-3 py-2">
                      {MOVEMENT_LABELS[movement.kind]}
                    </td>
                    <td className={TD}>
                      {movement.recordHref ? (
                        <Link
                          href={movement.recordHref}
                          className="text-accent hover:underline"
                        >
                          {movement.record}
                        </Link>
                      ) : (
                        movement.record
                      )}
                    </td>
                    <td className={TD}>
                      {movement.bookings.map((job, at) => (
                        <span key={`${job.id}-${at}`}>
                          {at ? ", " : ""}
                          {job.id ? (
                            <Link
                              href={`/admin/jobs/${job.id}`}
                              className="hover:underline"
                            >
                              {job.reference}
                            </Link>
                          ) : (
                            job.reference
                          )}
                        </span>
                      ))}
                    </td>
                    <td className={TD}>{movement.sourceLabel}</td>
                    <td
                      className="text-ink-2 max-w-[260px] truncate px-3 py-2"
                      title={movement.detail}
                    >
                      {movement.detail}
                    </td>
                    <td className={TD_NUM}>
                      {movement.inPence ? money(movement.inPence) : ""}
                    </td>
                    <td className={TD_NUM}>
                      {movement.outPence ? less(movement.outPence) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </OpsShell>
  );
}
