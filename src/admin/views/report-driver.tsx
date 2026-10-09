import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { clock, money } from "@/admin/format";
import { param, requireStaff, segment } from "@/admin/guard";
import { loadDriverJobs } from "@/admin/reports/drivers-data";
import { driverJobTotals } from "@/admin/reports/drivers-report";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { KpiTile } from "@/components/ops/charts/kpi";
import { counted } from "@/components/ops/charts/scale";
import { DRIVER_STATUS_TONE } from "@/components/ops/compliance";
import { NumberedPagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { JobStatusBadge } from "@/components/ops/jobs";
import { Badge, buttonClass, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { DRIVER_STATUS_LABELS } from "@/domain/fleet/labels";
import { formatDate } from "@/lib/time";
import type { Driver } from "@/payload-types";

/**
 * One driver in the Driver Report (`/reports/drivers/:id`; Cityline,
 * 9 Oct 2026): every job they did in the chosen dates — completed or PNS —
 * with what each was offered to them for. Whether they have been paid is
 * Finance's and never shows here. Owner and Controller, as the report.
 */

const PAGE_SIZE = 50;

const TH = "px-3 py-2 text-left font-semibold whitespace-nowrap";
const TH_NUM = "px-3 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";

export async function DriverJobsReportView(props: AdminViewServerProps) {
  const idSegment = segment(props, 2);
  const context = requireStaff(
    props,
    "reports.operational",
    `/admin/reports/drivers/${idSegment}`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const page = Math.max(1, Number.parseInt(param(props.searchParams, "page"), 10) || 1);
  const driverId = Number(idSegment);

  const driver =
    Number.isInteger(driverId) && driverId > 0
      ? ((await payload.findByID({
          collection: "drivers",
          id: driverId,
          depth: 0,
          user,
          overrideAccess: false,
          disableErrors: true,
        })) as Driver | null)
      : null;

  // The period, carried to the CSV, the pages and back to the report.
  const query = new URLSearchParams();
  if (period.key === "custom") {
    query.set("from", period.from);
    query.set("to", period.to);
  } else if (period.key !== "this_month") {
    query.set("period", period.key);
  }
  const back = `/admin/reports/drivers${query.size ? `?${query}` : ""}`;

  if (!driver) {
    return (
      <OpsShell user={user} active="driver-reports">
        <Panel>
          <EmptyState
            title="No driver with that number"
            action={
              <Link href={back} className={buttonClass("secondary", "md")}>
                Back to the Driver Report
              </Link>
            }
          />
        </Panel>
      </OpsShell>
    );
  }

  const jobs = await loadDriverJobs(payload, user, driver.id, period);
  const totals = driverJobTotals(jobs);
  const name = driver.fullName ?? `Driver ${driver.id}`;
  const self = `/admin/reports/drivers/${driver.id}`;
  const csvQuery = new URLSearchParams(query);
  csvQuery.set("driver", String(driver.id));
  const pageHref = (number: number) => {
    const next = new URLSearchParams(query);
    if (number > 1) next.set("page", String(number));
    return `${self}${next.size ? `?${next}` : ""}`;
  };
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const shown = jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <OpsShell user={user} active="driver-reports">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Driver Report
        </Link>
      </div>
      <PageHeader
        title={name}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            {driver.status !== "active" ? (
              <Badge tone={DRIVER_STATUS_TONE[driver.status]}>
                {DRIVER_STATUS_LABELS[driver.status]}
              </Badge>
            ) : null}
            {driver.engagement === "outsourced" ? (
              <Badge tone="special">Outsourced</Badge>
            ) : null}
          </span>
        }
        description="Every job they did in these dates — completed or PNS — and what each was offered to them for."
        actions={
          <>
            <Link
              href={`/admin/drivers/${driver.id}`}
              className={buttonClass("ghost", "md")}
            >
              Driver&apos;s page
            </Link>
            <DownloadCsv href={`/api/reports/driver-jobs?${csvQuery}`} />
          </>
        }
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action={self} className={FILTER_GRID}>
          <PeriodFields period={period} />
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>

      <PeriodLine period={period} basis="by pickup date" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiTile
          label="Jobs done"
          value={totals.jobs}
          current={totals.jobs}
          hint={`${totals.completed} completed · ${totals.noShows} PNS`}
        />
        <KpiTile
          label="Driver pay offered"
          value={money(totals.offeredPence)}
          current={totals.offeredPence}
          unit="pence"
          tone={totals.unpriced ? "warn" : undefined}
          hint={
            totals.unpriced
              ? `${counted(totals.unpriced, "job")} with no driver price written`
              : "What these jobs were offered to them for"
          }
        />
        <KpiTile
          label="Last job"
          value={totals.lastJobAt ? formatDate(new Date(totals.lastJobAt)) : "—"}
          current={0}
          hint={
            totals.lastJobAt
              ? `At ${clock(new Date(totals.lastJobAt))}`
              : "None in these dates"
          }
        />
      </div>

      <Panel
        title="Jobs"
        description={
          jobs.length ? `${counted(jobs.length, "job")}, newest first` : undefined
        }
        bodyClassName="p-0"
      >
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs done in these dates"
            description="Try a longer period."
          />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sunken text-ink-3 text-xs">
                  <tr>
                    <th scope="col" className={TH}>
                      Date
                    </th>
                    <th scope="col" className={TH}>
                      Booking
                    </th>
                    <th scope="col" className={TH}>
                      Route
                    </th>
                    <th scope="col" className={TH}>
                      Status
                    </th>
                    <th scope="col" className={TH}>
                      Car
                    </th>
                    <th scope="col" className={TH_NUM}>
                      Driver pay
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((job) => {
                    const at = new Date(job.pickupAt);
                    return (
                      <tr key={job.id} className="border-line border-t align-top">
                        <td className={TD}>
                          <span className="text-ink block tabular-nums">
                            {formatDate(at)}
                          </span>
                          <span className="text-ink-3 text-xs tabular-nums">
                            {clock(at)}
                          </span>
                        </td>
                        <td className={TD}>
                          <Link
                            href={`/admin/jobs/${job.id}`}
                            className="text-accent font-medium tabular-nums hover:underline"
                          >
                            {job.reference}
                          </Link>
                        </td>
                        <td className="min-w-[16rem] px-3 py-2">
                          <span className="text-ink block">{job.pickupAddress}</span>
                          <span className="text-ink-3 block text-xs">
                            to {job.dropoff || "—"}
                          </span>
                        </td>
                        <td className={TD}>
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td className={`${TD} tabular-nums`}>{job.vehicleReg ?? "—"}</td>
                        <td className={`${TD} text-right tabular-nums`}>
                          {job.driverPricePence === null ? (
                            <span className="text-ink-3">Not written</span>
                          ) : (
                            <span className="text-ink font-medium">
                              {money(job.driverPricePence)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-line bg-sunken/60 border-t">
                    <th scope="row" colSpan={5} className={`${TH} text-ink-2`}>
                      Total offered
                    </th>
                    <td
                      className={`${TD} text-ink text-right font-semibold tabular-nums`}
                    >
                      {money(totals.offeredPence)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="border-line border-t px-4 py-3">
                <NumberedPagination
                  page={page}
                  totalPages={totalPages}
                  totalDocs={jobs.length}
                  hrefFor={pageHref}
                  noun="jobs"
                />
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </OpsShell>
  );
}
