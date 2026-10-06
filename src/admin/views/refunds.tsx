import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import {
  loadCancelledUnrefunded,
  loadRefunds,
  refundsTotal,
} from "@/admin/data/payments";
import { RefundList } from "@/admin/components/refund-list";
import { FindPaymentForm } from "@/admin/forms/refund-form";
import { param, requireStaff } from "@/admin/guard";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { KpiTile } from "@/components/ops/charts/kpi";
import { counted } from "@/components/ops/charts/scale";
import { FilterForm } from "@/components/ops/filter-form";
import { buttonClass, Notice, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { formatPence, type Pence } from "@/domain/money";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";

/**
 * Refunds (Cityline, 6 Oct 2026: made by hand). The office refunds in Stripe
 * or by bank — never from the admin — and records each one here, against the
 * payment it came from, so takings and profit stay right. Lists the refunds
 * in any period, and the paid bookings cancelled in it with none recorded.
 * Owner and Accounts.
 */

const money = (pence: number) => formatPence(pence as Pence);

export async function RefundsView(props: AdminViewServerProps) {
  const context = requireStaff(props, "refunds.view", "/admin/refunds");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const range = { start: period.start, end: period.end };
  const [refunds, previous, cancelled] = await Promise.all([
    loadRefunds(payload, user, range),
    loadRefunds(payload, user, {
      start: period.previous.start,
      end: period.previous.end,
    }),
    loadCancelledUnrefunded(payload, user, range),
  ]);
  const refunded = refundsTotal(refunds);
  const live = refunds.filter((refund) => !refund.voided);
  const canRecord = can(user.role, "refunds.record");
  const notice = param(props.searchParams, "notice");

  const csvQuery = new URLSearchParams();
  if (period.key === "custom") {
    csvQuery.set("from", period.from);
    csvQuery.set("to", period.to);
  } else if (period.key !== "this_month") {
    csvQuery.set("period", period.key);
  }

  return (
    <OpsShell user={user} active="refunds">
      {notice === "refund-voided" ? <Notice tone="ok">Refund voided.</Notice> : null}
      <PageHeader
        title="Refunds"
        description="Refunds are made in Stripe, or by bank, by the office — never from here — then recorded here so takings and profit stay right."
      />

      {canRecord ? (
        <Panel
          title="Record a refund"
          description="Find the payment it came from by the booking's reference."
          className="mb-5"
        >
          <FindPaymentForm />
        </Panel>
      ) : null}

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/refunds" className={FILTER_GRID}>
          <PeriodFields period={period} />
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>
      <PeriodLine period={period} basis="by the date refunded" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Refunded"
          value={money(refunded)}
          current={refunded}
          previous={refundsTotal(previous)}
          unit="pence"
          better="down"
          compareName={period.previous.name}
          hint="Comes off takings, and off profit for work done"
        />
        <KpiTile
          label="Refunds"
          value={live.length}
          current={live.length}
          previous={previous.filter((refund) => !refund.voided).length}
          better="down"
          compareName={period.previous.name}
          hint={period.label}
        />
        <KpiTile
          label="Cancelled, paid, nothing refunded"
          value={cancelled.length}
          current={cancelled.length}
          tone={cancelled.length ? "warn" : undefined}
          hint={cancelled.length ? "Is a refund due?" : "None in these dates"}
        />
      </div>

      {cancelled.length ? (
        <Panel
          title="Cancelled and paid, nothing refunded"
          description="Bookings cancelled in these dates whose payment has no refund recorded. Check the cancellation terms; record a refund once made."
          className="mb-5"
          bodyClassName="p-0"
        >
          <ul className="divide-line divide-y">
            {cancelled.map((job) => (
              <li
                key={job.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <Link
                    href={`/admin/jobs/${job.id}`}
                    className="text-ink font-medium hover:underline"
                  >
                    {job.reference}
                  </Link>
                  <span className="text-ink-3">
                    {" "}
                    · {job.customer} · cancelled {formatDate(new Date(job.cancelledAt))} ·
                    paid {money(job.paidPence)}
                  </span>
                </span>
                <Link
                  href={`${job.paymentHref}#record-refund`}
                  className={buttonClass("secondary", "sm")}
                >
                  {canRecord ? "Record a refund" : "Payment"}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel
        title="Refunds recorded"
        description={`${counted(refunds.length, "refund")} · ${money(refunded)}${refunds.some((refund) => refund.voided) ? " (void ones not counted)" : ""}`}
        actions={
          <DownloadCsv
            href={`/api/reports/refunds${csvQuery.size ? `?${csvQuery}` : ""}`}
          />
        }
        bodyClassName="p-0"
      >
        {refunds.length === 0 ? (
          <EmptyState title="No refunds in this period" />
        ) : (
          <RefundList
            refunds={refunds}
            canVoid={canRecord}
            back="/admin/refunds"
            showPayment
          />
        )}
      </Panel>
    </OpsShell>
  );
}
