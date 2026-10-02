import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { clock, shortDay } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import {
  filterQuery,
  loadJobsReport,
  parseJobsReportFilters,
} from "@/admin/reports/jobs-data";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { BarList } from "@/components/ops/charts/bar-list";
import { ColumnChart } from "@/components/ops/charts/column-chart";
import { Heatmap } from "@/components/ops/charts/heatmap";
import { KpiTile } from "@/components/ops/charts/kpi";
import { percent } from "@/components/ops/charts/scale";
import { TipLayer } from "@/components/ops/charts/tip-layer";
import { NumberedPagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Label, Select } from "@/components/ops/form-controls";
import { JobStatusBadge } from "@/components/ops/jobs";
import { buttonClass, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { JOB_SOURCE_LABELS, JOB_SOURCES, JOB_STATUSES } from "@/domain/jobs/labels";
import { SERVICE_LABELS } from "@/domain/jobs/service";
import { stageName } from "@/domain/jobs/status";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * The Jobs Report (approved by Cityline, 2 Oct 2026): how much work the office
 * did and how it went, as an analytical dashboard over the raw rows, which
 * download as CSV. Counted by pickup date; no money (Finance has it); test
 * bookings never counted. Owner and Controller.
 */

const PAGE_SIZE = 50;

export async function JobsReportView(props: AdminViewServerProps) {
  const context = requireStaff(props, "reports.operational", "/admin/reports/jobs");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const filters = parseJobsReportFilters(params);
  const page = Math.max(1, Number.parseInt(param(props.searchParams, "page"), 10) || 1);

  const [{ report, rows }, suppliers, drivers] = await Promise.all([
    loadJobsReport(payload, user, period, filters, now),
    payload.find({
      collection: "suppliers",
      sort: "name",
      pagination: false,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: "drivers",
      sort: "fullName",
      pagination: false,
      depth: 0,
      user,
      overrideAccess: false,
    }),
  ]);

  // The query that reproduces this view: for pages and the CSV download.
  const query = filterQuery(filters);
  if (period.key === "custom") {
    query.set("from", period.from);
    query.set("to", period.to);
  } else if (period.key !== "this_month") {
    query.set("period", period.key);
  }
  const href = (change: Record<string, string>) => {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(change)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/admin/reports/jobs${next.size ? `?${next}` : ""}`;
  };
  const csvHref = `/api/reports/jobs${query.size ? `?${query}` : ""}`;

  const { totals, previous, rates } = report;
  const compare = period.previous.name;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const peakHour = report.heat
    .flatMap((row, day) => row.map((count, hour) => ({ day, hour, count })))
    .sort((a, b) => b.count - a.count)[0];
  const DAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  return (
    <OpsShell user={user} active="jobs-report">
      <PageHeader
        title="Jobs Report"
        description="How much work the office did, and how it went. Counted by pickup date; test bookings are never counted."
        actions={<DownloadCsv href={csvHref} />}
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/reports/jobs" className={FILTER_GRID}>
          <PeriodFields period={period} />
          <div>
            <Label htmlFor="report-source">Source</Label>
            <Select id="report-source" name="source" defaultValue={filters.source}>
              <option value="">Any source</option>
              {JOB_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {JOB_SOURCE_LABELS[source]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="report-supplier">Client</Label>
            <Select
              id="report-supplier"
              name="supplier"
              defaultValue={filters.supplier ?? ""}
            >
              <option value="">Any client</option>
              {suppliers.docs.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="report-driver">Driver</Label>
            <Select id="report-driver" name="driver" defaultValue={filters.driver ?? ""}>
              <option value="">Any driver</option>
              {drivers.docs.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="report-vehicle">Car</Label>
            <Select id="report-vehicle" name="vehicle" defaultValue={filters.vehicle}>
              <option value="">Any car</option>
              {VEHICLE_CLASSES.map((vehicle) => (
                <option key={vehicle.slug} value={vehicle.slug}>
                  {vehicle.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="report-service">Service</Label>
            <Select id="report-service" name="service" defaultValue={filters.service}>
              <option value="">Any service</option>
              {Object.entries(SERVICE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="report-status">Status</Label>
            <Select id="report-status" name="status" defaultValue={filters.status}>
              <option value="">Any status</option>
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {stageName(status)}
                </option>
              ))}
            </Select>
          </div>
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>

      <PeriodLine period={period} basis="by pickup date" />

      <TipLayer className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiTile
            label="Bookings"
            value={totals.bookings}
            current={totals.bookings}
            previous={previous.bookings}
            compareName={compare}
          />
          <KpiTile
            label="Completed"
            value={totals.completed}
            current={totals.completed}
            previous={previous.completed}
            compareName={compare}
            hint={
              rates.completion === null
                ? undefined
                : `${percent(rates.completion)} of bookings not cancelled`
            }
          />
          <KpiTile
            label="Passenger no-shows (PNS)"
            value={totals.noShows}
            current={totals.noShows}
            previous={previous.noShows}
            better="down"
            compareName={compare}
            hint={
              rates.noShow === null
                ? undefined
                : `${percent(rates.noShow)} of bookings not cancelled`
            }
          />
          <KpiTile
            label="Cancelled"
            value={totals.cancelled}
            current={totals.cancelled}
            previous={previous.cancelled}
            better="down"
            compareName={compare}
            hint={
              rates.cancellation === null
                ? undefined
                : `${percent(rates.cancellation)} of all bookings`
            }
          />
          <KpiTile
            label="Pickup passed, not closed"
            value={totals.notClosed}
            current={totals.notClosed}
            tone={totals.notClosed ? "warn" : undefined}
            hint={
              totals.notClosed
                ? "Move each one on to Completed or PNS so the register is right."
                : `${totals.open} still to happen or under way`
            }
          />
        </div>

        {totals.bookings === 0 ? (
          <Panel>
            <EmptyState
              title="No bookings in this period"
              description="Try a longer period or clear a filter."
            />
          </Panel>
        ) : (
          <>
            <Panel
              title={
                report.series.unit === "day" ? "Bookings per day" : "Bookings per week"
              }
              description={
                report.series.unit === "week"
                  ? "Weeks start on Monday. Hover a column for its number."
                  : "Hover a column for its number."
              }
            >
              <ColumnChart
                points={report.series.points.map((point) => ({
                  key: point.key,
                  label: point.label,
                  value: point.total,
                  tip: `${point.label} · ${point.completed} completed, ${point.noShows} PNS, ${point.cancelled} cancelled`,
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
                        <th className="py-1 pr-4 text-left font-medium">
                          {report.series.unit === "day" ? "Day" : "Week"}
                        </th>
                        <th className="py-1 pr-4 text-right font-medium">Bookings</th>
                        <th className="py-1 pr-4 text-right font-medium">Completed</th>
                        <th className="py-1 pr-4 text-right font-medium">PNS</th>
                        <th className="py-1 text-right font-medium">Cancelled</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {report.series.points.map((point) => (
                        <tr key={point.key} className="border-line border-t">
                          <td className="py-1 pr-4">{point.label}</td>
                          <td className="py-1 pr-4 text-right">{point.total}</td>
                          <td className="py-1 pr-4 text-right">{point.completed}</td>
                          <td className="py-1 pr-4 text-right">{point.noShows}</td>
                          <td className="py-1 text-right">{point.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Panel>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title="By client" description="Where the bookings came from">
                <BarList rows={report.byClient} />
              </Panel>
              <Panel title="By service" description="Bookings that went ahead">
                <BarList rows={report.byService} />
              </Panel>
              <Panel
                title="By airport"
                description="Pickups from, or drop-offs at, each airport"
              >
                <BarList
                  rows={report.byAirport}
                  empty="No airport trips in this period."
                />
              </Panel>
              <Panel title="By car" description="The class booked">
                <BarList rows={report.byVehicle} />
              </Panel>
            </div>

            <Panel
              title="Busy hours"
              description={
                peakHour && peakHour.count
                  ? `When pickups happen, London time. Busiest: ${DAY_NAMES[peakHour.day]}s around ${String(peakHour.hour).padStart(2, "0")}:00.`
                  : "When pickups happen, London time."
              }
            >
              <Heatmap grid={report.heat} />
            </Panel>

            <div className="grid gap-5 lg:grid-cols-3">
              <Panel
                title="How far ahead bookings come in"
                description="From taking the booking to the pickup"
              >
                <BarList rows={report.leadTime} />
              </Panel>
              <Panel
                title="Dispatch"
                description="Giving each booking a driver in good time"
              >
                <dl className="flex flex-col gap-4">
                  <div>
                    <dt className="text-ink-3 text-sm">
                      Driver assigned under 2 hours before pickup
                    </dt>
                    <dd className="text-ink mt-1 text-2xl font-semibold">
                      {report.lateDispatch.count}
                      <span className="text-ink-3 ml-2 text-sm font-normal">
                        of {report.lateDispatch.of} given a driver
                        {report.lateDispatch.of
                          ? ` (${percent(report.lateDispatch.count / report.lateDispatch.of)})`
                          : ""}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-3 text-sm">
                      Pickup reached with no driver assigned
                    </dt>
                    <dd
                      className={
                        report.noDriverAtPickup
                          ? "text-danger mt-1 text-2xl font-semibold"
                          : "text-ink mt-1 text-2xl font-semibold"
                      }
                    >
                      {report.noDriverAtPickup}
                    </dd>
                  </div>
                  {report.enteredAfterPickup ? (
                    <div>
                      <dt className="text-ink-3 text-sm">
                        Entered after the pickup time
                      </dt>
                      <dd className="text-warn mt-1 text-2xl font-semibold">
                        {report.enteredAfterPickup}
                      </dd>
                      <p className="text-ink-3 mt-1 text-xs">
                        Left out of the figures above. TfL expects every booking to be
                        recorded before the journey starts.
                      </p>
                    </div>
                  ) : null}
                </dl>
              </Panel>
              <Panel
                title="Why bookings were cancelled"
                description="As written when cancelling"
              >
                <BarList
                  rows={report.cancelReasons}
                  empty="No cancellations in this period."
                />
              </Panel>
            </div>
          </>
        )}
      </TipLayer>

      <Panel
        className="mt-5"
        title="All bookings in this period"
        description={`${rows.length} ${rows.length === 1 ? "booking" : "bookings"} — the raw data behind the figures above.`}
        actions={<DownloadCsv href={csvHref} />}
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState title="No bookings in this period" />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-sunken text-ink-3">
                  <tr>
                    {[
                      "Booking",
                      "Pickup",
                      "Route",
                      "Client",
                      "Passenger",
                      "Car",
                      "Driver",
                      "Status",
                      "Taken by",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const at = new Date(row.pickupAt);
                    return (
                      <tr key={row.id} className="border-line border-t align-top">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link
                            href={`/admin/jobs/${row.id}`}
                            className="text-ink font-medium hover:underline"
                          >
                            {row.reference}
                          </Link>
                          {row.supplierReference || row.bookingReference ? (
                            <span className="text-ink-3 block">
                              {row.supplierReference ?? row.bookingReference}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                          {shortDay(at)} {clock(at)}
                          {row.flightNumber ? (
                            <span className="text-ink-3 block">{row.flightNumber}</span>
                          ) : null}
                        </td>
                        <td className="text-ink-2 max-w-64 min-w-48 px-3 py-2">
                          <span className="line-clamp-1">{row.pickupAddress}</span>
                          <span className="text-ink-3 line-clamp-1">
                            →{" "}
                            {row.dropoffAddress ||
                              (row.hours ? `${row.hours} hours` : "As directed")}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.supplierName ??
                            JOB_SOURCE_LABELS[
                              row.source as keyof typeof JOB_SOURCE_LABELS
                            ]}
                        </td>
                        <td className="max-w-40 truncate px-3 py-2">{row.passenger}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {VEHICLE_CLASSES.find(
                            (item) => item.slug === row.vehicleClassSlug,
                          )?.name ?? row.vehicleClassSlug}
                          <span className="text-ink-3 block">{row.passengers} pax</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.driverName ?? <span className="text-ink-4">—</span>}
                          {row.vehicleReg ? (
                            <span className="text-ink-3 block">{row.vehicleReg}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <JobStatusBadge status={row.status} short />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.takenBy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="border-line border-t px-4 py-3">
                <NumberedPagination
                  page={page}
                  totalPages={totalPages}
                  totalDocs={rows.length}
                  hrefFor={(target) => href({ page: target > 1 ? String(target) : "" })}
                />
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </OpsShell>
  );
}
