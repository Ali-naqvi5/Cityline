import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import {
  loadPartnersOwed,
  loadReceipts,
  receivedTotal,
} from "@/admin/data/supplier-money";
import { isValidDay, londonDay, londonDayBounds } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { KpiTile } from "@/components/ops/charts/kpi";
import { counted } from "@/components/ops/charts/scale";
import { FilterForm } from "@/components/ops/filter-form";
import { Label, TextInput } from "@/components/ops/form-controls";
import { Badge, buttonClass, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { relId } from "@/domain/dispatch/assignment";
import {
  RECEIPT_METHODS,
  receiptReference,
  type ReceiptMethod,
} from "@/domain/finance/supplier-money";
import { formatPence, type Pence } from "@/domain/money";
import { formatDate } from "@/lib/time";
import type { Supplier, User } from "@/payload-types";

/**
 * Supplier Money (approved by Cityline, 6 Oct 2026): what each partner owes
 * for the bookings they sent — completed, PNS and late cancellations they pay
 * for, less the penalties they take off (Cityline, 16 Oct 2026) — what is
 * overdue on their terms, what needs a decision, and the money received in
 * any period. Owner and Accounts.
 */

const TH = "px-3 py-2 text-left font-semibold whitespace-nowrap";
const TH_NUM = "px-3 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";
const TD_NUM = "px-3 py-2 text-right whitespace-nowrap tabular-nums";
const money = (pence: number) => formatPence(pence as Pence);

export async function SupplierMoneyView(props: AdminViewServerProps) {
  const context = requireStaff(props, "supplierMoney.view", "/admin/supplier-money");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const today = londonDay(now);
  const upToParam = param(props.searchParams, "upTo");
  const upTo = isValidDay(upToParam) ? upToParam : today;
  const period = resolvePeriod(params, now);

  const [rows, receipts, previous] = await Promise.all([
    loadPartnersOwed(payload, user, londonDayBounds(upTo).end, now),
    loadReceipts(payload, user, { start: period.start, end: period.end }),
    loadReceipts(payload, user, {
      start: period.previous.start,
      end: period.previous.end,
    }),
  ]);
  const owed = rows.reduce((sum, row) => sum + row.owed.netPence, 0);
  const overdue = rows.reduce((sum, row) => sum + row.owed.overduePence, 0);
  const toDecide = rows.reduce((sum, row) => sum + row.owed.toDecide.length, 0);
  const received = receivedTotal(receipts);

  const csvQuery = new URLSearchParams();
  if (period.key === "custom") {
    csvQuery.set("from", period.from);
    csvQuery.set("to", period.to);
  } else if (period.key !== "this_month") {
    csvQuery.set("period", period.key);
  }
  const upToLabel = formatDate(new Date(`${upTo}T12:00:00Z`));

  return (
    <OpsShell user={user} active="supplier-money">
      <PageHeader
        title="Supplier Money"
        description="What each partner owes for the bookings they sent — completed, PNS, and late cancellations they pay for — and the money received."
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/supplier-money" className={FILTER_GRID}>
          <div>
            <Label htmlFor="money-up-to">Owed up to</Label>
            <TextInput id="money-up-to" name="upTo" type="date" defaultValue={upTo} />
          </div>
          <PeriodFields period={period} />
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label={`Owed by partners, up to ${upToLabel}`}
          value={money(owed)}
          current={owed}
          hint={counted(rows.filter((row) => row.owed.netPence > 0).length, "partner")}
        />
        <KpiTile
          label="Overdue"
          value={money(overdue)}
          current={overdue}
          tone={overdue ? "danger" : undefined}
          hint="Past each partner's payment terms"
        />
        <KpiTile
          label="Cancellations to decide"
          value={toDecide}
          current={toDecide}
          tone={toDecide ? "warn" : undefined}
          hint={toDecide ? "Does the partner pay for each?" : "Every one decided"}
        />
        <KpiTile
          label="Received from partners"
          value={money(received)}
          current={received}
          previous={receivedTotal(previous)}
          unit="pence"
          compareName={period.previous.name}
          hint={period.label}
        />
      </div>

      <Panel
        title={`Owed up to ${upToLabel}`}
        description="Bookings not yet paid for, by partner"
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing owed"
            description="Every partner booking up to this day is paid for."
          />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Partner
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Bookings
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Owed
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Overdue
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Not invoiced
                  </th>
                  <th scope="col" className={TH}>
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.supplier.id} className="border-line border-t">
                    <td className={TD}>
                      <span className="text-ink font-medium">{row.supplier.name}</span>
                      {row.owed.toDecide.length ? (
                        <Badge tone="warn" className="ml-2 align-middle">
                          {row.owed.toDecide.length} to decide
                        </Badge>
                      ) : null}
                    </td>
                    <td className={TD_NUM}>{row.owed.owed.length}</td>
                    <td className={`${TD_NUM} font-semibold`}>
                      {money(row.owed.netPence)}
                      {row.owed.penaltiesPence ? (
                        <span className="text-ink-3 block text-xs font-normal">
                          after {money(row.owed.penaltiesPence)} penalties
                        </span>
                      ) : null}
                    </td>
                    <td className={TD_NUM}>
                      {row.owed.overduePence ? (
                        <span className="text-danger">
                          {money(row.owed.overduePence)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={TD_NUM}>{row.owed.uninvoiced}</td>
                    <td className={`${TD} text-right`}>
                      <Link
                        href={`/admin/supplier-money/${row.supplier.id}?upTo=${upTo}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-5">
        <PeriodLine period={period} basis="by the date received" />
      </div>
      <Panel
        title="Money received"
        description={`${counted(receipts.length, "payment")} · ${money(received)}${receipts.some((receipt) => receipt.voidedAt) ? " (void ones not counted)" : ""}`}
        actions={
          <DownloadCsv
            href={`/api/reports/partner-receipts${csvQuery.size ? `?${csvQuery}` : ""}`}
          />
        }
        bodyClassName="p-0"
      >
        {receipts.length === 0 ? (
          <EmptyState title="Nothing received in this period" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Receipt
                  </th>
                  <th scope="col" className={TH}>
                    Received
                  </th>
                  <th scope="col" className={TH}>
                    Partner
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Bookings
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Amount
                  </th>
                  <th scope="col" className={TH}>
                    How
                  </th>
                  <th scope="col" className={TH}>
                    Recorded by
                  </th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => {
                  const supplier =
                    receipt.supplier && typeof receipt.supplier === "object"
                      ? (receipt.supplier as Supplier)
                      : null;
                  const recordedBy =
                    receipt.recordedBy && typeof receipt.recordedBy === "object"
                      ? ((receipt.recordedBy as User).name ??
                        (receipt.recordedBy as User).email)
                      : "Staff";
                  return (
                    <tr
                      key={receipt.id}
                      className={
                        receipt.voidedAt
                          ? "border-line text-ink-3 border-t"
                          : "border-line border-t"
                      }
                    >
                      <td className={TD}>
                        <span
                          className={
                            receipt.voidedAt ? "line-through" : "text-ink font-medium"
                          }
                        >
                          {receiptReference(receipt.id)}
                        </span>
                        {receipt.voidedAt ? (
                          <Badge tone="danger" className="ml-2 align-middle">
                            Void
                          </Badge>
                        ) : null}
                      </td>
                      <td className={`${TD} tabular-nums`}>
                        {formatDate(new Date(receipt.receivedAt))}
                      </td>
                      <td className={TD}>
                        <Link
                          href={`/admin/supplier-money/${relId(receipt.supplier)}`}
                          className="hover:underline"
                        >
                          {supplier?.name ?? "Partner"}
                        </Link>
                      </td>
                      <td className={TD_NUM}>{receipt.lines?.length ?? 0}</td>
                      <td className={`${TD_NUM} font-medium`}>
                        {money(receipt.amountPence ?? 0)}
                      </td>
                      <td className={TD}>
                        {RECEIPT_METHODS[receipt.method as ReceiptMethod] ??
                          receipt.method}
                        {receipt.reference ? (
                          <span className="text-ink-3 block text-xs">
                            {receipt.reference}
                          </span>
                        ) : null}
                      </td>
                      <td className={TD}>{recordedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </OpsShell>
  );
}
