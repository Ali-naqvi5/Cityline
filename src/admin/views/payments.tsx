import { Download, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { fetchCardFeesAction } from "@/admin/actions/payments";
import {
  feesMissing,
  loadAwaiting,
  loadRefunds,
  loadTakings,
  periodTakings,
} from "@/admin/data/payments";
import { clock, londonDay, shortDay } from "@/admin/format";
import { CustomerPaymentForm } from "@/admin/forms/customer-payment-form";
import { param, requireStaff } from "@/admin/guard";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { KpiTile } from "@/components/ops/charts/kpi";
import { counted } from "@/components/ops/charts/scale";
import { ActionButton } from "@/components/ops/dialog";
import { FilterForm } from "@/components/ops/filter-form";
import {
  Badge,
  buttonClass,
  Notice,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { PAYMENT_METHOD_LABELS } from "@/domain/jobs/labels";
import { formatPence, type Pence } from "@/domain/money";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";

/**
 * Payments (approved by Cityline, 6 Oct 2026): money in from customers.
 * Website card payments come from Stripe, with Stripe's fee once Stripe has
 * worked it out; office bookings paid by card link, bank transfer or on
 * account are marked paid here, and the ones still waiting are listed.
 * Refunds are made in Stripe or by bank and recorded by hand. Owner and
 * Accounts.
 */

const TH = "px-3 py-2 text-left font-semibold whitespace-nowrap";
const TH_NUM = "px-3 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";
const TD_NUM = "px-3 py-2 text-right whitespace-nowrap tabular-nums";
const money = (pence: number) => formatPence(pence as Pence);

export async function PaymentsView(props: AdminViewServerProps) {
  const context = requireStaff(props, "payments.view", "/admin/payments");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const seesRefunds = can(user.role, "refunds.view");
  const canRecord = can(user.role, "payments.record");
  const [{ awaiting, changed }, rows, previousRows, refunds, previousRefunds, missing] =
    await Promise.all([
      loadAwaiting(payload, user),
      loadTakings(payload, user, { start: period.start, end: period.end }),
      loadTakings(payload, user, {
        start: period.previous.start,
        end: period.previous.end,
      }),
      seesRefunds
        ? loadRefunds(payload, user, { start: period.start, end: period.end })
        : Promise.resolve([]),
      seesRefunds
        ? loadRefunds(payload, user, {
            start: period.previous.start,
            end: period.previous.end,
          })
        : Promise.resolve([]),
      feesMissing(payload, user),
    ]);
  const totals = periodTakings(rows, refunds);
  const before = periodTakings(previousRows, previousRefunds);
  const awaitingPence = awaiting.reduce((sum, line) => sum + line.pricePence, 0);
  const pickedUp = awaiting.filter((line) => new Date(line.pickupAt) < now);

  const notice = param(props.searchParams, "notice");
  const added = param(props.searchParams, "id");
  const got = Number(param(props.searchParams, "got")) || 0;
  const waiting = Number(param(props.searchParams, "waiting")) || 0;

  const csvQuery = new URLSearchParams();
  if (period.key === "custom") {
    csvQuery.set("from", period.from);
    csvQuery.set("to", period.to);
  } else if (period.key !== "this_month") {
    csvQuery.set("period", period.key);
  }

  return (
    <OpsShell user={user} active="payments">
      {notice === "paid" ? <Notice tone="ok">Payment recorded.</Notice> : null}
      {notice === "fees" ? (
        <Notice tone={waiting ? "warn" : "ok"}>
          {got
            ? `${counted(got, "card fee")} read from Stripe.`
            : "No card fees read from Stripe."}
          {waiting
            ? ` ${counted(waiting, "payment")} still waiting — Stripe works its fee out shortly after a payment; try again later.`
            : ""}
        </Notice>
      ) : null}
      <PageHeader
        title="Payments"
        description="Money in from customers: card payments on the website, from Stripe, and office bookings paid by card link, bank transfer or on account, marked paid here."
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/payments" className={FILTER_GRID}>
          <PeriodFields period={period} />
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>
      <PeriodLine period={period} basis="by the date paid, and refunds by their date" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Taken"
          value={money(totals.takenPence)}
          current={totals.takenPence}
          previous={before.takenPence}
          unit="pence"
          compareName={period.previous.name}
          hint={counted(rows.filter((row) => !row.voided).length, "payment")}
        />
        <KpiTile
          label="Refunded"
          value={money(totals.refundedPence)}
          current={totals.refundedPence}
          previous={before.refundedPence}
          unit="pence"
          better="down"
          compareName={period.previous.name}
          hint={
            seesRefunds ? (
              <Link href="/admin/refunds" className="hover:underline">
                Recorded by hand — see Refunds
              </Link>
            ) : undefined
          }
        />
        <KpiTile
          label="Card fees"
          value={money(totals.feesPence)}
          current={totals.feesPence}
          previous={before.feesPence}
          unit="pence"
          better="down"
          compareName={period.previous.name}
          tone={totals.feesUnknown ? "warn" : undefined}
          hint={
            totals.feesUnknown
              ? `${counted(totals.feesUnknown, "payment")} with no fee from Stripe yet`
              : "Stripe's, and any entered for card links"
          }
        />
        <KpiTile
          label="Kept"
          value={money(totals.keptPence)}
          current={totals.keptPence}
          previous={before.keptPence}
          unit="pence"
          compareName={period.previous.name}
          hint="Taken, less refunds and card fees"
        />
      </div>

      <Panel
        title="Waiting for payment"
        description={
          awaiting.length
            ? `${counted(awaiting.length, "office booking")} · ${money(awaitingPence)}${pickedUp.length ? ` · ${pickedUp.length} already picked up` : ""}`
            : "Office bookings paid by card link, bank transfer or on account"
        }
        className="mb-5"
      >
        {changed.length ? (
          <div className="border-warn-line bg-warn-soft text-ink mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
            <TriangleAlert aria-hidden className="text-warn mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">The price changed after these were paid:</p>
              <ul className="mt-1">
                {changed.map((job) => (
                  <li key={job.id}>
                    <Link href={`/admin/jobs/${job.id}`} className="hover:underline">
                      {job.reference}
                    </Link>{" "}
                    · {job.customer} · paid {money(job.paidPence)}, now{" "}
                    {money(job.pricePence)} ·{" "}
                    <Link
                      href={`/admin/payments/office/${job.paymentId}`}
                      className="text-accent hover:underline"
                    >
                      the payment
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-ink-3 mt-1 text-xs">
                Take or refund the difference with the customer; to record a new amount,
                void the payment and record it again.
              </p>
            </div>
          </div>
        ) : null}
        {awaiting.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="Every office booking paid by card link, bank transfer or on account is marked paid."
          />
        ) : canRecord ? (
          <CustomerPaymentForm
            key={added || awaiting.map((line) => line.id).join(",")}
            today={londonDay(now)}
            lines={awaiting.map((line) => ({
              id: line.id,
              reference: line.reference,
              customer: line.customer,
              when: `${shortDay(new Date(line.pickupAt))} ${clock(new Date(line.pickupAt))}`,
              route: line.route,
              how: PAYMENT_METHOD_LABELS[line.paymentMethod] ?? line.paymentMethod,
              pickedUp: new Date(line.pickupAt) < now,
              amountPence: line.pricePence,
            }))}
          />
        ) : (
          <p className="text-ink-2 text-sm">
            {counted(awaiting.length, "booking")}, {money(awaitingPence)} waiting.
          </p>
        )}
      </Panel>

      <Panel
        title="Money in"
        description={`${counted(rows.length, "payment")} · ${money(totals.takenPence)}${rows.some((row) => row.voided) ? " (void ones not counted)" : ""}`}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {missing.length && canRecord ? (
              <ActionButton
                label={`Get ${counted(missing.length, "card fee")} from Stripe`}
                icon={<Download aria-hidden className="h-4 w-4" />}
                size="sm"
                pendingLabel="Asking Stripe…"
                action={fetchCardFeesAction}
                fields={{}}
              />
            ) : null}
            <DownloadCsv
              href={`/api/reports/payments${csvQuery.size ? `?${csvQuery}` : ""}`}
            />
          </div>
        }
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState title="No money in, in this period" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-ink-3 text-xs">
                <tr>
                  <th scope="col" className={TH}>
                    Paid
                  </th>
                  <th scope="col" className={TH}>
                    Payment
                  </th>
                  <th scope="col" className={TH}>
                    Customer
                  </th>
                  <th scope="col" className={TH}>
                    Bookings
                  </th>
                  <th scope="col" className={TH}>
                    How
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Amount
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Card fee
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Refunded
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className={
                      row.voided
                        ? "border-line text-ink-3 border-t"
                        : "border-line border-t"
                    }
                  >
                    <td className={`${TD} tabular-nums`}>
                      {formatDate(new Date(row.paidAt))}
                    </td>
                    <td className={TD}>
                      <Link
                        href={row.href}
                        className={
                          row.voided
                            ? "line-through hover:underline"
                            : "text-accent font-medium hover:underline"
                        }
                      >
                        {row.reference}
                      </Link>
                      {row.voided ? (
                        <Badge tone="danger" className="ml-2 align-middle">
                          Void
                        </Badge>
                      ) : null}
                    </td>
                    <td className={TD}>
                      {row.customer ?? "—"}
                      {row.paidBy ? (
                        <span className="text-ink-3 block text-xs">
                          paid by {row.paidBy}
                        </span>
                      ) : null}
                    </td>
                    <td className={TD}>
                      {row.bookings.map((job, index) => (
                        <span key={job.id}>
                          {index ? ", " : ""}
                          <Link
                            href={`/admin/jobs/${job.id}`}
                            className="hover:underline"
                          >
                            {job.reference}
                          </Link>
                        </span>
                      ))}
                    </td>
                    <td className={TD}>
                      {row.method}
                      {row.kind === "office" && row.externalReference ? (
                        <span className="text-ink-3 block text-xs">
                          {row.externalReference}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${TD_NUM} font-medium`}>{money(row.amountPence)}</td>
                    <td className={TD_NUM}>
                      {row.feePence === null ? (
                        <span className="text-ink-3">Not yet</span>
                      ) : row.feePence ? (
                        money(row.feePence)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={TD_NUM}>
                      {row.refundedPence ? money(row.refundedPence) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </OpsShell>
  );
}
