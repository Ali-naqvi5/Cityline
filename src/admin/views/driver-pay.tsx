import { FileText } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { isValidDay, londonDay, londonDayBounds, shortDay } from "@/admin/format";
import {
  loadOwed,
  loadPayments,
  paidTotal,
  payeeOfPayment,
  periodFromOf,
} from "@/admin/data/driver-pay";
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
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  paymentPeriod,
  paymentReference,
} from "@/domain/finance/driver-pay";
import { formatPence, type Pence } from "@/domain/money";
import { formatDate } from "@/lib/time";
import type { User } from "@/payload-types";

/**
 * Driver Pay (approved by Cityline, 6 Oct 2026): what each driver is owed for
 * their done bookings up to any chosen day — driver prices less cash they
 * collected — and every payment made, with the total paid in any period.
 * Owner and Accounts.
 */

const TH = "px-3 py-2 text-left font-semibold whitespace-nowrap";
const TH_NUM = "px-3 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";
const TD_NUM = "px-3 py-2 text-right whitespace-nowrap tabular-nums";

const money = (pence: number) => formatPence(pence as Pence);

export async function DriverPayView(props: AdminViewServerProps) {
  const context = requireStaff(props, "driverPay.view", "/admin/driver-pay");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const today = londonDay(now);
  const upToParam = param(props.searchParams, "upTo");
  const upTo = isValidDay(upToParam) ? upToParam : today;
  const before = londonDayBounds(upTo).end;
  const period = resolvePeriod(params, now);

  const [{ rows, changed }, payments, previous] = await Promise.all([
    loadOwed(payload, user, before),
    loadPayments(payload, user, { start: period.start, end: period.end }),
    loadPayments(payload, user, {
      start: period.previous.start,
      end: period.previous.end,
    }),
  ]);

  const toPay = rows.reduce((sum, row) => sum + Math.max(0, row.owed.netPence), 0);
  const cashHeld = rows.reduce((sum, row) => sum + row.owed.cashPence, 0);
  const missing = rows.reduce((sum, row) => sum + row.owed.missingPrice.length, 0);
  const paid = paidTotal(payments);
  const paidBefore = paidTotal(previous);

  const query = new URLSearchParams();
  if (upTo !== today) query.set("upTo", upTo);
  if (period.key === "custom") {
    query.set("from", period.from);
    query.set("to", period.to);
  } else if (period.key !== "this_month") {
    query.set("period", period.key);
  }
  const csvQuery = new URLSearchParams(query);
  csvQuery.delete("upTo");
  const csvHref = `/api/reports/driver-payments${csvQuery.size ? `?${csvQuery}` : ""}`;

  return (
    <OpsShell user={user} active="driver-pay">
      <PageHeader
        title="Driver Pay"
        description="What each driver is owed for their completed and PNS bookings — the driver price written on each, less cash they collected — and every payment made."
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/driver-pay" className={FILTER_GRID}>
          <div>
            <Label htmlFor="pay-up-to">Owed up to</Label>
            <TextInput id="pay-up-to" name="upTo" type="date" defaultValue={upTo} />
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
          label={`To pay, up to ${formatDate(new Date(`${upTo}T12:00:00Z`))}`}
          value={money(toPay)}
          current={toPay}
          hint={`${counted(rows.filter((row) => row.owed.netPence > 0).length, "driver")} owed`}
        />
        <KpiTile
          label="Cash drivers hold"
          value={money(cashHeld)}
          current={cashHeld}
          hint="Taken off what they are owed"
        />
        <KpiTile
          label="Done, no driver price"
          value={missing}
          current={missing}
          tone={missing ? "warn" : undefined}
          hint={
            missing
              ? "Write the price on each booking to pay it"
              : "Every done booking is priced"
          }
        />
        <KpiTile
          label="Paid to drivers"
          value={money(paid)}
          current={paid}
          previous={paidBefore}
          unit="pence"
          better="none"
          compareName={period.previous.name}
          hint={period.label}
        />
      </div>

      <Panel
        title={`Owed up to ${formatDate(new Date(`${upTo}T12:00:00Z`))}`}
        description="Completed and PNS bookings not yet paid, less any share of partner penalties"
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing owed"
            description="Every done booking up to this day is paid."
          />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Driver
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Bookings
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Driver prices
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Cash held
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Penalties
                  </th>
                  <th scope="col" className={TH_NUM}>
                    To pay
                  </th>
                  <th scope="col" className={TH}>
                    Oldest
                  </th>
                  <th scope="col" className={TH}>
                    <span className="sr-only">Pay</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.payee.kind}:${row.payee.id}`}
                    className="border-line border-t"
                  >
                    <td className={TD}>
                      <span className="text-ink font-medium">{row.payee.name}</span>
                      {row.payee.kind === "operator" ? (
                        <Badge tone="special" className="ml-2 align-middle">
                          Operator
                        </Badge>
                      ) : null}
                      {row.owed.missingPrice.length ? (
                        <Badge tone="warn" className="ml-2 align-middle">
                          {row.owed.missingPrice.length} without a price
                        </Badge>
                      ) : null}
                    </td>
                    <td className={TD_NUM}>{row.owed.payable.length}</td>
                    <td className={TD_NUM}>{money(row.owed.earnedPence)}</td>
                    <td className={TD_NUM}>
                      {row.owed.cashPence ? `-${money(row.owed.cashPence)}` : "—"}
                    </td>
                    <td className={TD_NUM}>
                      {row.owed.penaltiesPence
                        ? `-${money(row.owed.penaltiesPence)}`
                        : "—"}
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>
                      {row.owed.netPence >= 0 ? (
                        money(row.owed.netPence)
                      ) : (
                        <span className="text-warn">
                          owes {money(-row.owed.netPence)}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} tabular-nums`}>
                      {row.oldest ? shortDay(new Date(row.oldest)) : "—"}
                    </td>
                    <td className={`${TD} text-right`}>
                      <Link
                        href={`${row.payee.payHref}?upTo=${upTo}`}
                        className={buttonClass("secondary", "sm")}
                      >
                        Review and pay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {changed.length ? (
        <Panel
          className="mt-5"
          title="Price changed after payment"
          description="The driver price on these bookings changed after they were paid: settle the difference with the driver."
          bodyClassName="p-0"
        >
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Booking
                  </th>
                  <th scope="col" className={TH}>
                    Driver
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Paid at
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Price now
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody>
                {changed.map((job) => {
                  const difference =
                    (job.driverPricePence ?? 0) - (job.driverPaidPricePence ?? 0);
                  return (
                    <tr key={job.id} className="border-line border-t">
                      <td className={TD}>
                        <Link
                          href={`/admin/jobs/${job.id}`}
                          className="text-ink font-medium hover:underline"
                        >
                          {job.reference}
                        </Link>
                      </td>
                      <td className={TD}>{job.payee?.name ?? "—"}</td>
                      <td className={TD_NUM}>{money(job.driverPaidPricePence ?? 0)}</td>
                      <td className={TD_NUM}>{money(job.driverPricePence ?? 0)}</td>
                      <td className={`${TD_NUM} font-medium`}>
                        {difference > 0
                          ? `${money(difference)} more to pay`
                          : `${money(-difference)} overpaid`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="mt-5">
        <PeriodLine period={period} basis="by the date paid" />
      </div>
      <Panel
        title="Payments made"
        description={`${counted(payments.length, "payment")} · ${money(paid)} paid${payments.some((payment) => payment.voidedAt) ? " (void payments not counted)" : ""}`}
        actions={<DownloadCsv href={csvHref} />}
        bodyClassName="p-0"
      >
        {payments.length === 0 ? (
          <EmptyState title="No payments in this period" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Payment
                  </th>
                  <th scope="col" className={TH}>
                    Paid
                  </th>
                  <th scope="col" className={TH}>
                    Driver
                  </th>
                  <th scope="col" className={TH}>
                    Covers
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
                  <th scope="col" className={TH}>
                    <span className="sr-only">Statement</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const payee = payeeOfPayment(payment);
                  const recordedBy =
                    payment.recordedBy && typeof payment.recordedBy === "object"
                      ? ((payment.recordedBy as User).name ??
                        (payment.recordedBy as User).email)
                      : "Staff";
                  return (
                    <tr
                      key={payment.id}
                      className={
                        payment.voidedAt
                          ? "border-line text-ink-3 border-t"
                          : "border-line border-t"
                      }
                    >
                      <td className={TD}>
                        <span
                          className={
                            payment.voidedAt ? "line-through" : "text-ink font-medium"
                          }
                        >
                          {paymentReference(payment.id)}
                        </span>
                        {payment.voidedAt ? (
                          <Badge tone="danger" className="ml-2 align-middle">
                            Void
                          </Badge>
                        ) : null}
                      </td>
                      <td className={`${TD} tabular-nums`}>
                        {formatDate(new Date(payment.paidAt))}
                      </td>
                      <td className={TD}>
                        {payee ? (
                          <Link href={payee.payHref} className="hover:underline">
                            {payee.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>
                        {paymentPeriod(periodFromOf(payment), new Date(payment.upTo))}
                      </td>
                      <td className={TD_NUM}>{payment.lines?.length ?? 0}</td>
                      <td className={`${TD_NUM} font-medium`}>
                        {(payment.amountPence ?? 0) >= 0
                          ? money(payment.amountPence ?? 0)
                          : `${money(-(payment.amountPence ?? 0))} from driver`}
                      </td>
                      <td className={TD}>
                        {PAYMENT_METHODS[payment.method as PaymentMethod] ??
                          payment.method}
                        {payment.reference ? (
                          <span className="text-ink-3 block text-xs">
                            {payment.reference}
                          </span>
                        ) : null}
                      </td>
                      <td className={TD}>{recordedBy}</td>
                      <td className={`${TD} text-right`}>
                        <a
                          href={`/api/driver-pay/${payment.id}/statement`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent inline-flex items-center gap-1 hover:underline"
                        >
                          <FileText aria-hidden className="h-4 w-4" />
                          PDF
                        </a>
                      </td>
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
