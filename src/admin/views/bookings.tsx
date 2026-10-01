import {
  AlertTriangle,
  Pencil,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Route as RouteIcon,
  Search,
  Timer,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps, Where } from "payload";

import {
  activeFilterCount,
  bookingsHref,
  bookingsSort,
  buildBookingsWhere,
  PAGE_SIZES,
  parseBookingFilters,
  WHEN_LABELS,
  WHEN_PRESETS,
  type BookingFilters,
} from "@/admin/data/booking-filters";
import {
  clock,
  londonDayBounds,
  londonDay,
  money,
  relative,
  shortDay,
} from "@/admin/format";
import { NextStageButtons } from "@/admin/forms/stage-controls";
import { requireStaff } from "@/admin/guard";
import { ClickableRow } from "@/components/ops/clickable-row";
import { NumberedPagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Checkbox, Label, Select, TextInput } from "@/components/ops/form-controls";
import { isUrgent, JobStatusBadge, TestBadge } from "@/components/ops/jobs";
import {
  buttonClass,
  ButtonLink,
  cx,
  MetricCard,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { EmptyState, ErrorState, NoAccess } from "@/components/ops/states";
import {
  JOB_SOURCE_LABELS,
  JOB_SOURCES,
  JOB_STATUS_SHORT,
  JOB_STATUSES,
  OPEN_STATUSES,
  PAYMENT_METHOD_LABELS,
  vehicleClassName,
  type JobStatus,
} from "@/domain/jobs/labels";
import { beforeBoarding, isFinal, stageName } from "@/domain/jobs/status";
import { SERVICE_LABELS, serviceType, type ServiceType } from "@/domain/jobs/service";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { can } from "@/domain/staff/permissions";
import type { Booking, Driver, Job, Supplier, User } from "@/payload-types";

/**
 * The bookings dashboard (spec §9, Cityline's brief of 2 Oct 2026): every
 * booking from every source in one dense, colour-coded register — the way
 * Cityline's controllers already work — filtered and paged in the database.
 * A click opens the booking, where the driver's price is written.
 */

// --- Colours ------------------------------------------------------------------

// The same colour per stage as the status badges (`components/ops/jobs`).
const ROW_TONE: Record<JobStatus, string> = {
  unassigned: "bg-warn-soft",
  assigned: "bg-accent-soft",
  driver_confirmed: "bg-cat-6-soft",
  on_the_way: "bg-cat-1-soft",
  at_pickup: "bg-cat-5-soft",
  on_board: "bg-special-soft",
  completed: "bg-surface",
  no_show: "bg-cat-4-soft",
  cancelled: "bg-sunken text-ink-3",
};
const EDGE: Record<JobStatus, string> = {
  unassigned: "border-l-warn",
  assigned: "border-l-accent",
  driver_confirmed: "border-l-cat-6",
  on_the_way: "border-l-cat-1",
  at_pickup: "border-l-cat-5",
  on_board: "border-l-special",
  completed: "border-l-ok",
  no_show: "border-l-cat-4",
  cancelled: "border-l-line",
};
const URGENT_ROW = "bg-danger-soft";
const URGENT_EDGE = "border-l-danger";

const CLIENT_COLOURS = [
  "border-cat-1-line bg-cat-1-soft text-cat-1",
  "border-cat-2-line bg-cat-2-soft text-cat-2",
  "border-cat-3-line bg-cat-3-soft text-cat-3",
  "border-cat-4-line bg-cat-4-soft text-cat-4",
  "border-cat-5-line bg-cat-5-soft text-cat-5",
  "border-cat-6-line bg-cat-6-soft text-cat-6",
];

function client(job: Job): { label: string; className: string } {
  const supplier =
    typeof job.supplier === "object" ? (job.supplier as Supplier | null) : null;
  if (supplier) {
    return {
      label: supplier.name,
      className: CLIENT_COLOURS[supplier.id % CLIENT_COLOURS.length]!,
    };
  }
  if (job.source === "website") {
    return {
      label: "Website",
      className: "border-accent-line bg-accent-soft text-accent",
    };
  }
  return {
    label: JOB_SOURCE_LABELS[job.source as keyof typeof JOB_SOURCE_LABELS] ?? job.source,
    className: "border-line-strong bg-surface text-ink-2",
  };
}

const SERVICE_ICON: Record<ServiceType, React.ReactNode> = {
  from_airport: <PlaneLanding aria-hidden className="h-3.5 w-3.5" />,
  to_airport: <PlaneTakeoff aria-hidden className="h-3.5 w-3.5" />,
  airport_to_airport: <PlaneTakeoff aria-hidden className="h-3.5 w-3.5" />,
  transfer: <RouteIcon aria-hidden className="h-3.5 w-3.5" />,
  hourly: <Timer aria-hidden className="h-3.5 w-3.5" />,
};

function orderNumber(job: Job): string | null {
  if (job.supplierReference) return job.supplierReference;
  return typeof job.booking === "object" && job.booking
    ? (job.booking as Booking).reference
    : null;
}

const firstName = (name: string | null | undefined) => (name ?? "").split(" ")[0] || "—";

// --- Filters ------------------------------------------------------------------

interface Choices {
  suppliers: Supplier[];
  drivers: Driver[];
  staff: User[];
}

function Filters({ filters, choices }: { filters: BookingFilters; choices: Choices }) {
  const active = activeFilterCount(filters);
  return (
    <FilterForm
      action="/admin/bookings"
      className="border-line grid grid-cols-2 gap-3 border-b p-4 md:grid-cols-4 xl:grid-cols-6"
    >
      <div className="col-span-2 flex items-end gap-2 md:col-span-4 xl:col-span-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor="bookings-q">Search</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="text-ink-4 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
            />
            <TextInput
              id="bookings-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Booking, order no., passenger, phone, email, flight, reg"
              className="pl-8"
            />
          </div>
        </div>
        {/* Phones only: the other filters fold away (spec §45). */}
        <label
          htmlFor="bookings-filters-toggle"
          className={cx(buttonClass("secondary", "md"), "cursor-pointer md:hidden")}
        >
          Filters{active ? ` · ${active}` : ""}
        </label>
      </div>

      {/* No name, so it is never part of the query. */}
      <input id="bookings-filters-toggle" type="checkbox" className="peer sr-only" />

      <div className="col-span-2 hidden grid-cols-2 gap-3 peer-checked:grid md:col-span-4 md:grid md:grid-cols-4 xl:col-span-4 xl:grid-cols-4">
        <div>
          <Label htmlFor="bookings-when">Pickup</Label>
          {/* A preset clears the dates below; dates set this to "All dates". */}
          <Select
            id="bookings-when"
            name="when"
            defaultValue={filters.when === "range" ? "all" : filters.when}
            data-clear="from,to"
          >
            {WHEN_PRESETS.map((when) => (
              <option key={when} value={when}>
                {WHEN_LABELS[when]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-status">Status</Label>
          <Select id="bookings-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            <option value="open">Open (not finished)</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {stageName(status)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-source">Source</Label>
          <Select id="bookings-source" name="source" defaultValue={filters.source}>
            <option value="">Any source</option>
            {JOB_SOURCES.map((source) => (
              <option key={source} value={source}>
                {JOB_SOURCE_LABELS[source]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-supplier">Client</Label>
          <Select
            id="bookings-supplier"
            name="supplier"
            defaultValue={filters.supplier ?? ""}
          >
            <option value="">Any client</option>
            {choices.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="col-span-2 hidden grid-cols-2 gap-3 peer-checked:grid md:col-span-4 md:grid md:grid-cols-4 xl:col-span-6 xl:grid-cols-6">
        <div>
          <Label htmlFor="bookings-driver">Driver</Label>
          <Select id="bookings-driver" name="driver" defaultValue={filters.driver ?? ""}>
            <option value="">Any driver</option>
            <option value="none">No driver yet</option>
            {choices.drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-vehicle">Car</Label>
          <Select id="bookings-vehicle" name="vehicle" defaultValue={filters.vehicle}>
            <option value="">Any car</option>
            {VEHICLE_CLASSES.map((vehicle) => (
              <option key={vehicle.slug} value={vehicle.slug}>
                {vehicle.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-payment">Payment</Label>
          <Select id="bookings-payment" name="payment" defaultValue={filters.payment}>
            <option value="">Any payment</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-taken">Taken by</Label>
          <Select id="bookings-taken" name="takenBy" defaultValue={filters.takenBy ?? ""}>
            <option value="">Anyone</option>
            {choices.staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bookings-from">Pickup from</Label>
          <TextInput
            id="bookings-from"
            name="from"
            type="date"
            defaultValue={filters.from}
            data-set="when=all"
          />
        </div>
        <div>
          <Label htmlFor="bookings-to">Pickup to</Label>
          <TextInput
            id="bookings-to"
            name="to"
            type="date"
            defaultValue={filters.to}
            data-set="when=all"
          />
        </div>
        <div>
          <Label htmlFor="bookings-created-from">Taken from</Label>
          <TextInput
            id="bookings-created-from"
            name="createdFrom"
            type="date"
            defaultValue={filters.createdFrom}
          />
        </div>
        <div>
          <Label htmlFor="bookings-created-to">Taken to</Label>
          <TextInput
            id="bookings-created-to"
            name="createdTo"
            type="date"
            defaultValue={filters.createdTo}
          />
        </div>
        <div>
          <Label htmlFor="bookings-per">Per page</Label>
          <Select id="bookings-per" name="per" defaultValue={String(filters.perPage)}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 flex flex-wrap items-end gap-x-4 md:col-span-3 xl:col-span-3">
          <Checkbox
            id="bookings-no-price"
            name="noDriverPrice"
            value="1"
            defaultChecked={filters.noDriverPrice}
            label="No driver price yet"
          />
          <Checkbox
            id="bookings-test"
            name="test"
            value="1"
            defaultChecked={filters.includeTest}
            label="Show test bookings"
          />
          {active ? (
            <Link
              href="/admin/bookings"
              className="text-accent flex h-10 items-center text-sm font-medium hover:underline lg:h-9"
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      </div>

      <noscript>
        <button type="submit" className={buttonClass("secondary", "sm")}>
          Apply
        </button>
      </noscript>
    </FilterForm>
  );
}

// --- The register -------------------------------------------------------------

const TH =
  "px-2 py-2 text-left text-2xs font-semibold uppercase tracking-wide whitespace-nowrap";
const TD = "px-2 py-1.5 align-top";
// Columns that join as the screen widens. Everything fits a 1366px laptop;
// a 1920px office screen shows the lot.
const CAR = "hidden min-[1600px]:table-cell";
const PAYMENT = "hidden min-[1700px]:table-cell";
const WIDEST = "hidden min-[1840px]:table-cell";

function ClientChip({ job }: { job: Job }) {
  const { label, className } = client(job);
  return (
    <span
      className={cx(
        "inline-block max-w-32 truncate rounded-sm border px-1.5 py-px text-xs font-medium",
        className,
      )}
    >
      {label}
    </span>
  );
}

function BookingsTable({
  jobs,
  now,
  dispatches,
  edits,
  returnTo,
}: {
  jobs: Job[];
  now: Date;
  dispatches: boolean;
  edits: boolean;
  /** Where the stage buttons bring the operator back to: this page, as filtered. */
  returnTo: string;
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">Bookings</caption>
        <thead className="bg-header text-white">
          <tr>
            <th scope="col" className={TH}>
              Booking
            </th>
            <th scope="col" className={TH}>
              Pickup · service
            </th>
            <th scope="col" className={TH}>
              Pickup → Drop-off
            </th>
            <th scope="col" className={TH}>
              Client
            </th>
            <th scope="col" className={TH}>
              Passenger
            </th>
            <th scope="col" className={cx(TH, CAR)}>
              Car
            </th>
            <th scope="col" className={TH}>
              Driver
            </th>
            <th scope="col" className={TH}>
              Status
            </th>
            <th scope="col" className={cx(TH, PAYMENT)}>
              Payment
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              Price
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              Driver £
            </th>
            <th scope="col" className={cx(TH, WIDEST)}>
              Taken by
            </th>
            <th scope="col" className={cx(TH, WIDEST)}>
              Notes
            </th>
            <th scope="col" className={cx(TH, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const at = new Date(job.pickupAt);
            const urgent = isUrgent(job, now);
            const status = job.status as JobStatus;
            const driver =
              typeof job.driver === "object" ? (job.driver as Driver | null) : null;
            const taker =
              typeof job.takenByUser === "object"
                ? (job.takenByUser as User | null)
                : null;
            const service = serviceType(job);
            const order = orderNumber(job);
            const href = `/admin/jobs/${job.id}`;
            const closed = isFinal(status);
            const missingPrice =
              Boolean(driver) && job.driverPricePence == null && !closed;
            return (
              <ClickableRow
                key={job.id}
                href={href}
                className={cx(
                  "border-line border-b hover:brightness-[0.97]",
                  urgent ? URGENT_ROW : ROW_TONE[status],
                )}
              >
                <td
                  className={cx(
                    TD,
                    "border-l-4 whitespace-nowrap",
                    urgent ? URGENT_EDGE : EDGE[status],
                  )}
                >
                  <Link href={href} className="text-ink font-semibold hover:underline">
                    {job.reference}
                  </Link>
                  {order ? <span className="text-ink-3 block">{order}</span> : null}
                  {job.isTest ? <TestBadge /> : null}
                </td>
                <td className={cx(TD, "whitespace-nowrap")}>
                  <span className="text-ink text-sm font-semibold tabular-nums">
                    {clock(at)}
                  </span>{" "}
                  <span className="text-ink-3">{shortDay(at)}</span>
                  <span className="text-ink-2 flex items-center gap-1">
                    {SERVICE_ICON[service]}
                    {SERVICE_LABELS[service]}
                    {job.flightNumber ? (
                      <span className="text-ink font-medium">· {job.flightNumber}</span>
                    ) : null}
                  </span>
                  {urgent ? (
                    <span className="text-danger block font-medium">
                      {at < now ? "Overdue" : relative(at, now)}
                    </span>
                  ) : null}
                </td>
                <td className={cx(TD, "max-w-64 min-w-44")}>
                  <span className="text-ink-2 line-clamp-2">{job.pickupAddress}</span>
                  <span className="text-ink-3 line-clamp-2">
                    →{" "}
                    {job.dropoffAddress ||
                      (job.hours ? `${job.hours} hours` : "As directed")}
                  </span>
                </td>
                <td className={TD}>
                  <ClientChip job={job} />
                </td>
                <td className={cx(TD, "max-w-36")}>
                  <span className="text-ink block truncate font-medium">
                    {job.nameBoardText || job.leadName}
                  </span>
                  <span className="text-ink-3 block whitespace-nowrap tabular-nums">
                    {job.leadPhone}
                  </span>
                  <span className="text-ink-3 block min-[1600px]:hidden">
                    {vehicleClassName(job.vehicleClassSlug)} · {job.passengers} pax
                  </span>
                </td>
                <td className={cx(TD, CAR, "whitespace-nowrap")}>
                  <span className="text-ink-2">
                    {vehicleClassName(job.vehicleClassSlug)}
                  </span>
                  <span className="text-ink-3 block">{job.passengers} pax</span>
                </td>
                <td className={cx(TD, "max-w-36")}>
                  {driver ? (
                    <>
                      <span className="text-ink block truncate font-medium">
                        {driver.fullName}
                      </span>
                      <span className="text-ink-3 block whitespace-nowrap tabular-nums">
                        {job.vehicleReg}
                      </span>
                    </>
                  ) : closed ? (
                    <span className="text-ink-4">—</span>
                  ) : (
                    <span
                      className={cx("font-medium", urgent ? "text-danger" : "text-warn")}
                    >
                      No driver
                    </span>
                  )}
                </td>
                <td className={TD}>
                  <JobStatusBadge status={job.status} short />
                </td>
                <td className={cx(TD, PAYMENT, "whitespace-nowrap")}>
                  <span className="text-ink-2">
                    {PAYMENT_METHOD_LABELS[job.paymentMethod] ?? job.paymentMethod}
                  </span>
                </td>
                <td className={cx(TD, "text-right whitespace-nowrap")}>
                  <span className="text-ink font-semibold tabular-nums">
                    {money(job.customerPricePence)}
                  </span>
                </td>
                <td className={cx(TD, "text-right whitespace-nowrap")}>
                  {job.driverPricePence != null ? (
                    <span className="text-ink-2 font-medium tabular-nums">
                      {money(job.driverPricePence)}
                    </span>
                  ) : missingPrice ? (
                    <span className="text-warn font-medium">Not set</span>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td className={cx(TD, WIDEST, "whitespace-nowrap")}>
                  <span className="text-ink-2">
                    {job.source === "website" ? "Website" : firstName(taker?.name)}
                  </span>
                </td>
                <td className={cx(TD, WIDEST, "max-w-48")}>
                  <span className="text-ink-3 line-clamp-2">
                    {job.internalNotes || job.driverNotes || ""}
                  </span>
                </td>
                <td className={cx(TD, "text-right whitespace-nowrap")}>
                  <span className="inline-flex items-start gap-1">
                    {dispatches && driver ? (
                      <NextStageButtons job={job} now={now} compact returnTo={returnTo} />
                    ) : null}
                    {dispatches && beforeBoarding(status) ? (
                      <Link
                        href={`/admin/jobs/${job.id}/assign`}
                        aria-label={`${driver ? "Change driver for" : "Assign a driver to"} ${job.reference}`}
                        title={driver ? "Change driver" : "Assign driver"}
                        className={buttonClass(
                          driver ? "ghost" : "primary",
                          "sm",
                          "px-2",
                        )}
                      >
                        <UserPlus aria-hidden className="h-4 w-4" />
                      </Link>
                    ) : null}
                    {edits && !closed ? (
                      <Link
                        href={`/admin/jobs/${job.id}/edit`}
                        aria-label={`Edit ${job.reference}`}
                        title="Edit"
                        className={buttonClass("ghost", "sm", "px-2")}
                      >
                        <Pencil aria-hidden className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </span>
                </td>
              </ClickableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Below the desktop breakpoint: one card per booking (spec §45). */
function BookingCards({ jobs, now }: { jobs: Job[]; now: Date }) {
  return (
    <ul className="divide-line divide-y lg:hidden">
      {jobs.map((job) => {
        const at = new Date(job.pickupAt);
        const urgent = isUrgent(job, now);
        const status = job.status as JobStatus;
        const driver =
          typeof job.driver === "object" ? (job.driver as Driver | null) : null;
        const service = serviceType(job);
        return (
          <li key={job.id}>
            <Link
              href={`/admin/jobs/${job.id}`}
              className={cx(
                "flex flex-col gap-1.5 border-l-4 px-4 py-3",
                urgent
                  ? `${URGENT_ROW} ${URGENT_EDGE}`
                  : `${ROW_TONE[status]} ${EDGE[status]}`,
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="text-ink text-lg font-semibold tabular-nums">
                    {clock(at)}
                  </span>{" "}
                  <span className="text-ink-3 text-sm">{shortDay(at)}</span>
                  <span className="text-ink block text-base font-medium">
                    {job.nameBoardText || job.leadName}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <JobStatusBadge status={job.status} short />
                  <ClientChip job={job} />
                </span>
              </span>
              <span className="text-ink-2 text-sm">
                {job.pickupAddress}
                <span className="text-ink-3 block">
                  →{" "}
                  {job.dropoffAddress ||
                    (job.hours ? `${job.hours} hours` : "As directed")}
                </span>
              </span>
              <span className="text-ink-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span className="text-ink-2 font-medium">{job.reference}</span>
                <span>{SERVICE_LABELS[service]}</span>
                {job.flightNumber ? <span>{job.flightNumber}</span> : null}
                <span>
                  {vehicleClassName(job.vehicleClassSlug)} · {job.passengers} pax
                </span>
                <span className="tabular-nums">{money(job.customerPricePence)}</span>
                {job.driverPricePence != null ? (
                  <span className="tabular-nums">
                    Driver {money(job.driverPricePence)}
                  </span>
                ) : null}
              </span>
              <span
                className={cx(
                  "text-sm font-medium",
                  driver ? "text-ink-2" : urgent ? "text-danger" : "text-warn",
                )}
              >
                {driver
                  ? `${driver.fullName} · ${job.vehicleReg}`
                  : isFinal(status)
                    ? ""
                    : urgent
                      ? `No driver — ${at < now ? "overdue" : relative(at, now)}`
                      : "No driver"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Legend() {
  const items: { label: string; className: string }[] = [
    { label: "No driver, due within 24 h", className: `${URGENT_ROW} ${URGENT_EDGE}` },
    ...(
      [
        "unassigned",
        "assigned",
        "driver_confirmed",
        "on_the_way",
        "at_pickup",
        "on_board",
        "no_show",
        "completed",
        "cancelled",
      ] as const
    ).map((status) => ({
      label: JOB_STATUS_SHORT[status],
      className: `${ROW_TONE[status]} ${EDGE[status]}`,
    })),
  ];
  return (
    <ul aria-label="Row colours" className="hidden flex-wrap gap-x-3 gap-y-1 lg:flex">
      {items.map((item) => (
        <li key={item.label} className="text-ink-3 flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={cx(
              "border-line inline-block h-3 w-4 rounded-xs border border-l-4",
              item.className,
            )}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// --- The page -------------------------------------------------------------------

export async function BookingsView(props: AdminViewServerProps) {
  const context = requireStaff(props, "jobs.view", "/admin/bookings");
  if (context.denied) {
    return (
      <div className="ops-root min-h-dvh p-4">
        <NoAccess reason={context.reason} />
      </div>
    );
  }
  const { user, payload } = context;
  const now = new Date();
  const filters = parseBookingFilters(props.searchParams);
  const as = { user, overrideAccess: false } as const;
  const notTest: Where = { isTest: { not_equals: true } };
  const today = londonDayBounds(londonDay(now));

  let result: { docs: Job[]; totalDocs: number; totalPages: number } | null = null;
  try {
    const found = await payload.find({
      collection: "jobs",
      where: buildBookingsWhere(filters, now),
      sort: bookingsSort(filters),
      depth: 1,
      limit: filters.perPage,
      page: filters.page,
      ...as,
    });
    result = {
      docs: found.docs,
      totalDocs: found.totalDocs,
      totalPages: found.totalPages,
    };
  } catch (error) {
    console.error("[admin/bookings] could not load bookings", error);
  }

  const [suppliers, drivers, staff, todayCount, needDriver, noPrice] = await Promise.all([
    payload.find({
      collection: "suppliers",
      sort: "name",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({
      collection: "drivers",
      where: { status: { not_equals: "left" } },
      sort: "fullName",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.find({
      collection: "users",
      sort: "name",
      pagination: false,
      depth: 0,
      ...as,
    }),
    payload.count({
      collection: "jobs",
      where: {
        and: [
          notTest,
          { status: { not_equals: "cancelled" } },
          { pickupAt: { greater_than_equal: today.start.toISOString() } },
          { pickupAt: { less_than: today.end.toISOString() } },
        ],
      },
      ...as,
    }),
    payload.count({
      collection: "jobs",
      where: {
        and: [
          notTest,
          { status: { equals: "unassigned" } },
          { pickupAt: { less_than: new Date(now.getTime() + 86_400_000).toISOString() } },
        ],
      },
      ...as,
    }),
    payload.count({
      collection: "jobs",
      where: {
        and: [
          notTest,
          { status: { in: [...OPEN_STATUSES, "completed"] } },
          { driver: { exists: true } },
          { driverPricePence: { exists: false } },
        ],
      },
      ...as,
    }),
  ]);

  const dispatches = can(user.role, "jobs.dispatch");
  const edits = can(user.role, "jobs.edit");
  const filtered = activeFilterCount(filters) > 0 || Boolean(filters.q);

  return (
    <OpsShell user={user} active="bookings" wide>
      <PageHeader
        title="Bookings"
        description="Every booking from every source — the register TfL inspects. Click a booking to open it and write the driver's price."
        actions={
          <>
            {dispatches ? (
              <ButtonLink href="/admin/dispatch">Dispatch board</ButtonLink>
            ) : null}
            {edits ? (
              <ButtonLink href="/admin/jobs/new" variant="primary">
                <Plus aria-hidden className="h-4 w-4" />
                New booking
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Today's pickups"
          value={todayCount.totalDocs}
          href={bookingsHref(parseBookingFilters({}), { when: "today" })}
        />
        <MetricCard
          label="Need a driver (24 h)"
          value={needDriver.totalDocs}
          tone={needDriver.totalDocs ? "danger" : undefined}
          icon={
            needDriver.totalDocs ? (
              <AlertTriangle aria-hidden className="text-danger h-4 w-4" />
            ) : undefined
          }
          href={dispatches ? "/admin/dispatch?unassigned=1" : undefined}
        />
        <MetricCard
          label="Driver price not written"
          value={noPrice.totalDocs}
          tone={noPrice.totalDocs ? "warn" : undefined}
          hint="Assigned or completed bookings"
          href={bookingsHref(parseBookingFilters({}), {
            when: "all",
            noDriverPrice: true,
          })}
        />
        <MetricCard
          label={filtered ? "Matching these filters" : "Upcoming bookings"}
          value={result?.totalDocs ?? "—"}
        />
      </div>

      <Panel bodyClassName="p-0">
        <Filters
          filters={filters}
          choices={{
            suppliers: suppliers.docs,
            drivers: drivers.docs,
            staff: staff.docs,
          }}
        />

        {!result ? (
          <ErrorState
            title="Unable to load bookings"
            description="Try again. If it keeps happening, tell the owner."
          />
        ) : result.docs.length === 0 ? (
          <EmptyState
            title={filtered ? "No bookings match these filters" : "No upcoming bookings"}
            description={
              filtered
                ? "Try a wider date range or clear a filter."
                : "New website bookings appear here as they are paid; add phone and supplier bookings with New booking."
            }
            action={
              filtered ? (
                <ButtonLink href="/admin/bookings">Clear filters</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <Legend />
              <NumberedPagination
                page={filters.page}
                totalPages={result.totalPages}
                totalDocs={result.totalDocs}
                hrefFor={(page) => bookingsHref(filters, { page })}
              />
              {result.totalPages <= 1 ? (
                <span className="text-ink-3 text-sm tabular-nums">
                  {result.totalDocs} {result.totalDocs === 1 ? "booking" : "bookings"}
                </span>
              ) : null}
            </div>
            <BookingsTable
              jobs={result.docs}
              now={now}
              dispatches={dispatches}
              edits={edits}
              returnTo={bookingsHref(filters)}
            />
            <BookingCards jobs={result.docs} now={now} />
            {result.totalPages > 1 ? (
              <div className="border-line border-t px-4 py-3">
                <NumberedPagination
                  page={filters.page}
                  totalPages={result.totalPages}
                  totalDocs={result.totalDocs}
                  hrefFor={(page) => bookingsHref(filters, { page })}
                />
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </OpsShell>
  );
}
