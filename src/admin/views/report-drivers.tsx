import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { clock, shortDay, stamp } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import {
  DRIVER_STATUSES,
  driversFilterQuery,
  loadDriversReport,
  parseDriversReportFilters,
} from "@/admin/reports/drivers-data";
import {
  minutesLate,
  minutesToConfirm,
  ON_TIME_GRACE_MINUTES,
} from "@/admin/reports/drivers-report";
import { resolvePeriod } from "@/admin/reports/period";
import { DownloadCsv, FILTER_GRID, PeriodFields, PeriodLine } from "@/admin/reports/ui";
import { BarList } from "@/components/ops/charts/bar-list";
import { DayGrid } from "@/components/ops/charts/day-grid";
import { KpiTile } from "@/components/ops/charts/kpi";
import { counted, percent } from "@/components/ops/charts/scale";
import { TipLayer } from "@/components/ops/charts/tip-layer";
import { DRIVER_STATUS_TONE } from "@/components/ops/compliance";
import { NumberedPagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Label, Select } from "@/components/ops/form-controls";
import { JobStatusBadge } from "@/components/ops/jobs";
import { Badge, buttonClass, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { PARTICULAR_LABELS } from "@/domain/fleet/driver-record";
import { DRIVER_STATUS_LABELS } from "@/domain/fleet/labels";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { formatDate } from "@/lib/time";

/**
 * The Driver Report (approved by Cityline, 5 Oct 2026): who did the work and
 * how reliably — on time at pickup with 15 minutes' grace, how quickly
 * drivers confirm, and every time a driver was taken off a booking, with the
 * reason. Below it, TfL's driver records: what the regulations require
 * Cityline to keep for each driver, and what is missing.
 *
 * An analytical dashboard over the raw rows, which download as CSV. Counted
 * by pickup date; no money (pay is Finance's); test bookings never counted.
 * Owner and Controller.
 */

const PAGE_SIZE = 50;

const TH = "px-3 py-2 text-left font-semibold whitespace-nowrap";
const TH_NUM = "px-3 py-2 text-right font-semibold whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";
const TD_NUM = "px-3 py-2 text-right whitespace-nowrap tabular-nums";

/** "2027-09-30" as "30 Sept 2027". */
const dayText = (day: string) => formatDate(new Date(`${day}T12:00:00Z`));

const minutesText = (minutes: number | null) =>
  minutes === null
    ? "—"
    : minutes < 90
      ? `${Math.round(minutes)} min`
      : `${(minutes / 60).toFixed(1)} h`;

export async function DriversReportView(props: AdminViewServerProps) {
  const context = requireStaff(props, "reports.operational", "/admin/reports/drivers");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const params = props.searchParams as Record<string, string | string[] | undefined>;
  const period = resolvePeriod(params, now);
  const filters = parseDriversReportFilters(params);
  const page = Math.max(1, Number.parseInt(param(props.searchParams, "page"), 10) || 1);

  const [{ report, rows, records }, suppliers, drivers] = await Promise.all([
    loadDriversReport(payload, user, period, filters, now),
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

  // The query that reproduces this view: for pages and the CSV downloads.
  const query = driversFilterQuery(filters);
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
    return `/admin/reports/drivers${next.size ? `?${next}` : ""}`;
  };
  const csv = (data?: string) => {
    const next = new URLSearchParams(query);
    if (data) next.set("data", data);
    return `/api/reports/drivers${next.size ? `?${next}` : ""}`;
  };

  const { totals, previous } = report;
  const compare = period.previous.name;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const complete = records.filter((record) => record.missing.length === 0).length;
  const notices = records.filter((record) => record.notice);
  const pct = (share: number | null) => (share === null ? null : Math.round(share * 100));

  return (
    <OpsShell user={user} active="driver-reports">
      <PageHeader
        title="Driver Report"
        description="Who did the work, how reliably, and whether each driver's TfL record is complete. Counted by pickup date; test bookings are never counted."
        actions={<DownloadCsv href={csv()} />}
      />

      <Panel bodyClassName="p-0" className="mb-4">
        <FilterForm action="/admin/reports/drivers" className={FILTER_GRID}>
          <PeriodFields period={period} />
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
            <Label htmlFor="report-driver-status">Driver status</Label>
            <Select
              id="report-driver-status"
              name="driverStatus"
              defaultValue={filters.driverStatus}
            >
              <option value="">Any status</option>
              {DRIVER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {DRIVER_STATUS_LABELS[status]}
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
          <noscript>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Apply
            </button>
          </noscript>
        </FilterForm>
      </Panel>

      <PeriodLine period={period} basis="by pickup date" />

      <TipLayer className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiTile
            label="Drivers who worked"
            value={totals.driversWorked}
            current={totals.driversWorked}
            previous={previous.driversWorked}
            better="none"
            compareName={compare}
            hint="With at least one booking completed or PNS"
          />
          <KpiTile
            label="Bookings driven"
            value={totals.driven}
            current={totals.driven}
            previous={previous.driven}
            compareName={compare}
            hint={
              totals.perDriver === null
                ? "Completed or PNS"
                : `${totals.perDriver.toFixed(1)} per driver who worked`
            }
          />
          <KpiTile
            label="On time at pickup"
            value={totals.onTimeShare === null ? "—" : percent(totals.onTimeShare)}
            current={pct(totals.onTimeShare) ?? 0}
            previous={totals.onTimeShare === null ? null : pct(previous.onTimeShare)}
            unit="percent"
            compareName={compare}
            hint={
              totals.arrivals
                ? `${totals.onTime} of ${counted(totals.arrivals, "arrival")} at DAP within ${ON_TIME_GRACE_MINUTES} min of the pickup time`
                : "No arrivals marked DAP in this period"
            }
          />
          <KpiTile
            label="Typical time to confirm"
            value={minutesText(totals.medianConfirmMinutes)}
            current={Math.round(totals.medianConfirmMinutes ?? 0)}
            previous={
              totals.medianConfirmMinutes === null ||
              previous.medianConfirmMinutes === null
                ? null
                : Math.round(previous.medianConfirmMinutes)
            }
            unit="minutes"
            better="down"
            compareName={compare}
            hint="From assigning to Driver confirmed, the middle booking"
          />
          <KpiTile
            label="Taken off bookings"
            value={totals.takenOff}
            current={totals.takenOff}
            previous={previous.takenOff}
            better="down"
            compareName={compare}
            hint="Each with the reason written"
          />
          <KpiTile
            label="TfL driver records complete"
            value={`${complete} of ${records.length}`}
            current={complete}
            tone={complete < records.length || notices.length ? "warn" : undefined}
            hint={
              notices.length
                ? `${counted(notices.length, "driver")} to report to TfL`
                : "Every driver Cityline must keep a record of, today"
            }
          />
        </div>

        {rows.length === 0 && report.takenOff.length === 0 ? (
          <Panel>
            <EmptyState
              title="No bookings with a driver in this period"
              description="Try a longer period or clear a filter."
            />
          </Panel>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Bookings driven, by driver"
                description="Completed or PNS in the period"
              >
                <BarList
                  rows={report.byDriver}
                  empty="No bookings driven in this period."
                />
              </Panel>
              <Panel
                title="Arrival at pickup"
                description={`DAP against the booked pickup time. Up to ${ON_TIME_GRACE_MINUTES} minutes after it counts as on time.`}
              >
                <BarList
                  rows={report.punctuality}
                  singular="arrival"
                  empty="No arrivals marked DAP in this period."
                />
                {report.arrivalNotRecorded ? (
                  <p className="text-ink-3 mt-3 text-xs">
                    {counted(report.arrivalNotRecorded, "booking")} driven with no DAP
                    time, so left out.
                  </p>
                ) : null}
              </Panel>
              <Panel
                title="Time to confirm"
                description="From assigning a booking to Driver confirmed"
              >
                <BarList
                  rows={report.confirmTime}
                  empty="No confirmations in this period."
                />
                {report.awaitingConfirmation ? (
                  <p className="text-ink-3 mt-3 text-xs">
                    {counted(report.awaitingConfirmation, "booking")} still waiting for
                    the driver to confirm.
                  </p>
                ) : null}
              </Panel>
              <Panel
                title="Why drivers were taken off"
                description="As written when taking them off"
              >
                <BarList
                  rows={report.takenOffReasons}
                  singular="time"
                  empty="No driver was taken off a booking in this period."
                />
              </Panel>
            </div>

            {report.grid.rows.length ? (
              <Panel
                title={
                  report.grid.unit === "day" ? "Bookings by day" : "Bookings by week"
                }
                description={
                  report.grid.unit === "week"
                    ? "Each driver's bookings, not cancelled. Weeks start on Monday."
                    : "Each driver's bookings, not cancelled. Spot very heavy days."
                }
              >
                <DayGrid
                  columns={report.grid.columns}
                  rows={report.grid.rows.map((row) => ({ ...row, key: row.driverId }))}
                />
              </Panel>
            ) : null}
          </>
        )}
      </TipLayer>

      {report.drivers.length ? (
        <Panel
          className="mt-5"
          title="Drivers"
          description="One row per driver in the period"
          actions={<DownloadCsv href={csv("drivers")} />}
          bodyClassName="p-0"
        >
          <div className="relative overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sunken text-ink-3">
                <tr>
                  <th scope="col" className={TH}>
                    Driver
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Bookings
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Completed
                  </th>
                  <th scope="col" className={TH_NUM}>
                    PNS
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Taken off
                  </th>
                  <th scope="col" className={TH_NUM}>
                    On time
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Typical confirm
                  </th>
                  <th scope="col" className={TH_NUM}>
                    Days worked
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.drivers.map((row) => (
                  <tr key={row.driverId} className="border-line border-t">
                    <td className={TD}>
                      <Link
                        href={`/admin/drivers/${row.driverId}`}
                        className="text-ink font-medium hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.status !== "active" ? (
                        <Badge
                          tone={DRIVER_STATUS_TONE[row.status]}
                          className="ml-2 align-middle"
                        >
                          {DRIVER_STATUS_LABELS[row.status]}
                        </Badge>
                      ) : null}
                    </td>
                    <td className={TD_NUM}>{row.bookings}</td>
                    <td className={TD_NUM}>{row.completed}</td>
                    <td className={TD_NUM}>{row.noShows}</td>
                    <td className={TD_NUM}>{row.takenOff}</td>
                    <td className={TD_NUM}>
                      {row.arrivals
                        ? `${percent(row.onTime / row.arrivals)} of ${row.arrivals}`
                        : "—"}
                    </td>
                    <td className={TD_NUM}>{minutesText(row.medianConfirmMinutes)}</td>
                    <td className={TD_NUM}>{row.daysWorked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {report.takenOff.length ? (
        <Panel
          className="mt-5"
          title="Drivers taken off bookings"
          description={`${counted(report.takenOff.length, "time")} in this period, newest first`}
          actions={<DownloadCsv href={csv("taken-off")} />}
          bodyClassName="p-0"
        >
          <div className="relative overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sunken text-ink-3">
                <tr>
                  {["Booking", "Pickup", "Driver", "Taken off", "By", "Reason"].map(
                    (heading) => (
                      <th key={heading} scope="col" className={TH}>
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {report.takenOff.map((event, index) => (
                  <tr
                    key={`${event.jobId}-${event.at}-${index}`}
                    className="border-line border-t align-top"
                  >
                    <td className={TD}>
                      <Link
                        href={`/admin/jobs/${event.jobId}`}
                        className="text-ink font-medium hover:underline"
                      >
                        {event.reference}
                      </Link>
                    </td>
                    <td className={`${TD} tabular-nums`}>
                      {shortDay(new Date(event.pickupAt))}{" "}
                      {clock(new Date(event.pickupAt))}
                    </td>
                    <td className={TD}>{event.driverName}</td>
                    <td className={`${TD} tabular-nums`}>{stamp(new Date(event.at))}</td>
                    <td className={TD}>{event.by}</td>
                    <td className="text-ink-2 min-w-56 px-3 py-2 whitespace-pre-line">
                      {event.reason ?? (
                        <span className="text-ink-3">
                          Not recorded (before reasons were asked for)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel
        className="mt-5"
        id="tfl-records"
        title="TfL driver records"
        description="Today, whatever the period: every driver Cityline must keep a record of — available now, or stopped within the last 12 months — and what TfL asks for that is missing."
        actions={<DownloadCsv href={csv("records")}>Download TfL records</DownloadCsv>}
        bodyClassName="p-0"
      >
        {notices.length ? (
          <ul className="border-line flex flex-col gap-1 border-b px-4 py-3">
            {notices.map((record) => (
              <li
                key={record.driverId}
                className={
                  record.notice!.overdue ? "text-danger text-sm" : "text-warn text-sm"
                }
              >
                Tell TfL {record.notice!.overdue ? "now (it was due " : "by "}
                {dayText(record.notice!.due)}
                {record.notice!.overdue ? ")" : ""} that Cityline stopped using{" "}
                <Link
                  href={`/admin/drivers/${record.driverId}`}
                  className="font-medium underline"
                >
                  {record.name}
                </Link>{" "}
                because of their conduct: form PHV/105.
              </li>
            ))}
          </ul>
        ) : null}
        {records.length === 0 ? (
          <EmptyState title="No drivers on record" />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-sunken text-ink-3">
                <tr>
                  {["Driver", "Status", "Record", "Keep until"].map((heading) => (
                    <th key={heading} scope="col" className={TH}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.driverId} className="border-line border-t align-top">
                    <td className={TD}>
                      <Link
                        href={`/admin/drivers/${record.driverId}`}
                        className="text-ink font-medium hover:underline"
                      >
                        {record.name}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Badge tone={DRIVER_STATUS_TONE[record.status]}>
                        {DRIVER_STATUS_LABELS[record.status]}
                      </Badge>
                    </td>
                    <td className="min-w-64 px-3 py-2">
                      {record.missing.length === 0 ? (
                        <span className="text-ok font-medium">Complete</span>
                      ) : (
                        <span className="text-warn">
                          Missing:{" "}
                          {record.missing
                            .map((item) => PARTICULAR_LABELS[item])
                            .join(", ")}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} tabular-nums`}>
                      {record.keepUntil ? dayText(record.keepUntil) : "While available"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        className="mt-5"
        title="All bookings with a driver in this period"
        description={`${counted(rows.length, "booking")} — the raw data behind the figures above.`}
        actions={<DownloadCsv href={csv()} />}
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState title="No bookings with a driver in this period" />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-sunken text-ink-3">
                  <tr>
                    <th scope="col" className={TH}>
                      Booking
                    </th>
                    <th scope="col" className={TH}>
                      Pickup
                    </th>
                    <th scope="col" className={TH}>
                      Driver
                    </th>
                    <th scope="col" className={TH}>
                      Client
                    </th>
                    <th scope="col" className={TH}>
                      Status
                    </th>
                    <th scope="col" className={TH_NUM}>
                      Confirmed after
                    </th>
                    <th scope="col" className={TH_NUM}>
                      At pickup (DAP)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const at = new Date(row.pickupAt);
                    const late = minutesLate(row);
                    const confirm = minutesToConfirm(row);
                    return (
                      <tr key={row.id} className="border-line border-t align-top">
                        <td className={TD}>
                          <Link
                            href={`/admin/jobs/${row.id}`}
                            className="text-ink font-medium hover:underline"
                          >
                            {row.reference}
                          </Link>
                          {row.supplierReference ? (
                            <span className="text-ink-3 block">
                              {row.supplierReference}
                            </span>
                          ) : null}
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {shortDay(at)} {clock(at)}
                        </td>
                        <td className={TD}>
                          {row.driverName}
                          {row.vehicleReg ? (
                            <span className="text-ink-3 block">{row.vehicleReg}</span>
                          ) : null}
                        </td>
                        <td className={TD}>{row.client}</td>
                        <td className="px-3 py-2">
                          <JobStatusBadge status={row.status} short />
                        </td>
                        <td className={TD_NUM}>{minutesText(confirm)}</td>
                        <td className={TD_NUM}>
                          {late === null ? (
                            <span className="text-ink-4">—</span>
                          ) : (
                            <span
                              className={
                                late <= ON_TIME_GRACE_MINUTES ? "text-ok" : "text-danger"
                              }
                            >
                              {late < 0
                                ? `${-late} min early`
                                : late === 0
                                  ? "On the minute"
                                  : `${late} min after`}
                            </span>
                          )}
                        </td>
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
