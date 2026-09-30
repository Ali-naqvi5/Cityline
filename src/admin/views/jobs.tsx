import { ChevronLeft, ChevronRight, Plane, Search } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import {
  buildJobsWhere,
  jobsHref,
  jobsSort,
  parseJobFilters,
  type JobFilters,
  type JobsWhen,
} from "@/admin/data/job-filters";
import {
  addDays,
  clock,
  dayHeading,
  londonDay,
  money,
  mondayOf,
  pickupLabel,
  relative,
  shortDay,
} from "@/admin/format";
import { requireStaff } from "@/admin/guard";
import { DataTable, Pagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Checkbox, Label, Select, TextInput } from "@/components/ops/form-controls";
import {
  isUrgent,
  JobCard,
  JobStatusBadge,
  Route,
  SourceBadge,
  TestBadge,
  UrgentBadge,
} from "@/components/ops/jobs";
import { buttonClass, cx, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { EmptyState, ErrorState, NoAccess } from "@/components/ops/states";
import {
  JOB_SOURCE_LABELS,
  JOB_SOURCES,
  JOB_STATUS_LABELS,
  JOB_STATUSES,
  vehicleClassName,
} from "@/domain/jobs/labels";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import type { Booking, Job } from "@/payload-types";

/**
 * The jobs register (spec §9): list, day and week views, filters and search,
 * all done in the database. Every source — website, supplier, phone — lives
 * in the one table.
 */

const PAGE_SIZE = 50;

const WHEN_LABELS: Record<JobsWhen, string> = {
  upcoming: "Upcoming",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "This week",
  past: "Past",
  all: "All dates",
  date: "Chosen date",
};

function bookingRef(job: Job): string | null {
  return typeof job.booking === "object" && job.booking
    ? (job.booking as Booking).reference
    : null;
}

function ViewTabs({ filters }: { filters: JobFilters }) {
  const tabs = [
    { view: "list" as const, label: "List" },
    { view: "day" as const, label: "Day" },
    { view: "week" as const, label: "Week" },
  ];
  return (
    <div
      role="tablist"
      aria-label="View"
      className="border-line-strong bg-surface inline-flex rounded-md border p-0.5 shadow-xs"
    >
      {tabs.map((tab) => {
        const active = filters.view === tab.view;
        return (
          <Link
            key={tab.view}
            role="tab"
            aria-selected={active}
            href={jobsHref(filters, { view: tab.view, page: 1 })}
            className={cx(
              "flex h-9 items-center rounded-sm px-3 text-sm font-medium lg:h-7",
              active ? "bg-accent-soft text-accent" : "text-ink-3 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function Filters({ filters }: { filters: JobFilters }) {
  const active = [
    filters.view === "list" && filters.when !== "upcoming",
    filters.status,
    filters.source,
    filters.vehicle,
    filters.unassigned,
    filters.includeTest,
  ].filter(Boolean).length;

  return (
    <FilterForm
      action="/admin/jobs"
      className="border-line grid grid-cols-1 gap-3 border-b p-4 md:grid-cols-4 xl:grid-cols-[minmax(200px,1.6fr)_repeat(4,minmax(128px,1fr))_auto]"
    >
      {filters.view !== "list" ? (
        <input type="hidden" name="view" value={filters.view} />
      ) : null}
      {filters.view !== "list" ? (
        <input type="hidden" name="date" value={filters.date} />
      ) : null}

      <div className="flex items-end gap-2 md:col-span-4 xl:col-span-1">
        <div className="min-w-0 flex-1">
          <Label htmlFor="jobs-q">Search</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="text-ink-4 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
            />
            <TextInput
              id="jobs-q"
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Reference, passenger, phone, flight"
              className="pl-8"
            />
          </div>
        </div>
        {/* Phones only: the other filters fold away (spec §45). */}
        <label
          htmlFor="jobs-filters-toggle"
          className={cx(buttonClass("secondary", "md"), "cursor-pointer md:hidden")}
        >
          Filters{active ? ` · ${active}` : ""}
        </label>
      </div>

      {/* No name, so it is never part of the query. */}
      <input id="jobs-filters-toggle" type="checkbox" className="peer sr-only" />

      <div className="hidden grid-cols-2 gap-3 peer-checked:grid md:contents">
        {filters.view === "list" ? (
          <div>
            <Label htmlFor="jobs-when">When</Label>
            <Select
              id="jobs-when"
              name="when"
              defaultValue={filters.when === "date" ? "upcoming" : filters.when}
            >
              {(Object.keys(WHEN_LABELS) as JobsWhen[])
                .filter((when) => when !== "date")
                .map((when) => (
                  <option key={when} value={when}>
                    {WHEN_LABELS[when]}
                  </option>
                ))}
            </Select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="jobs-status">Status</Label>
          <Select id="jobs-status" name="status" defaultValue={filters.status}>
            <option value="">Any status</option>
            {JOB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="jobs-source">Source</Label>
          <Select id="jobs-source" name="source" defaultValue={filters.source}>
            <option value="">Any source</option>
            {JOB_SOURCES.map((source) => (
              <option key={source} value={source}>
                {JOB_SOURCE_LABELS[source]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="jobs-vehicle">Vehicle class</Label>
          <Select id="jobs-vehicle" name="vehicle" defaultValue={filters.vehicle}>
            <option value="">Any class</option>
            {VEHICLE_CLASSES.map((vehicle) => (
              <option key={vehicle.slug} value={vehicle.slug}>
                {vehicle.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="col-span-2 flex flex-wrap items-end gap-x-4 md:col-span-4 xl:col-span-1">
          <Checkbox
            id="jobs-unassigned"
            name="unassigned"
            value="1"
            defaultChecked={filters.unassigned}
            label="Unassigned only"
          />
          <Checkbox
            id="jobs-test"
            name="test"
            value="1"
            defaultChecked={filters.includeTest}
            label="Show test bookings"
          />
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

function ListView({
  jobs,
  now,
  filters,
  totalDocs,
  totalPages,
}: {
  jobs: Job[];
  now: Date;
  filters: JobFilters;
  totalDocs: number;
  totalPages: number;
}) {
  return (
    <>
      <DataTable
        caption="Jobs"
        rows={jobs}
        rowKey={(job) => job.id}
        rowHref={(job) => `/admin/jobs/${job.id}`}
        rowClassName={(job) => (isUrgent(job, now) ? "bg-danger-soft/50" : undefined)}
        card={(job) => <JobCard job={job} now={now} />}
        columns={[
          {
            key: "pickup",
            header: "Pickup",
            cell: (job) => (
              <Link
                href={`/admin/jobs/${job.id}`}
                className="text-ink block whitespace-nowrap hover:underline"
              >
                <span className="font-medium tabular-nums">
                  {pickupLabel(new Date(job.pickupAt))}
                </span>
                <span className="text-ink-3 block text-xs">
                  {job.reference} · {relative(new Date(job.pickupAt), now)}
                </span>
                {job.isTest ? <TestBadge /> : null}
              </Link>
            ),
          },
          {
            key: "passenger",
            header: "Passenger",
            cell: (job) => (
              <div className="min-w-28">
                <span className="text-ink font-medium">
                  {job.nameBoardText || job.leadName}
                </span>
                <span className="text-ink-3 block text-xs tabular-nums">
                  {job.leadPhone}
                </span>
              </div>
            ),
          },
          {
            key: "route",
            header: "Pickup → Drop-off",
            cell: (job) => (
              <Route
                from={job.pickupAddress}
                to={job.dropoffAddress}
                className="max-w-52 xl:max-w-64"
              />
            ),
          },
          {
            key: "flight",
            header: "Flight",
            hideBelow: "xl",
            cell: (job) =>
              job.flightNumber ? (
                <span className="text-ink-2 inline-flex items-center gap-1 whitespace-nowrap">
                  <Plane aria-hidden className="text-ink-4 h-3.5 w-3.5" />
                  {job.flightNumber}
                </span>
              ) : (
                <span className="text-ink-4">—</span>
              ),
          },
          {
            key: "vehicle",
            header: "Class",
            hideBelow: "wide",
            cell: (job) => (
              <span className="text-ink-2 whitespace-nowrap">
                {vehicleClassName(job.vehicleClassSlug)}
                <span className="text-ink-3 block text-xs">
                  {job.passengers} pax · {job.largeBags + job.smallBags} bags
                </span>
              </span>
            ),
          },
          {
            key: "source",
            header: "Source",
            hideBelow: "2xl",
            cell: (job) => (
              <div className="flex flex-col items-start gap-0.5">
                <SourceBadge source={job.source} />
                {bookingRef(job) ? (
                  <span className="text-ink-3 text-xs">{bookingRef(job)}</span>
                ) : null}
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (job) => (
              <div className="flex flex-col items-start gap-1">
                <JobStatusBadge status={job.status} />
                {job.vehicleReg ? (
                  <span className="text-ink-3 text-xs">
                    {job.vehicleReg}
                    {job.driverPhvNo ? ` · PHV ${job.driverPhvNo}` : ""}
                  </span>
                ) : null}
                {isUrgent(job, now) ? (
                  <UrgentBadge pickupAt={job.pickupAt} now={now} />
                ) : null}
              </div>
            ),
          },
          {
            key: "price",
            header: "Price",
            align: "right",
            hideBelow: "xl",
            cell: (job) => (
              <span className="text-ink font-medium tabular-nums">
                {money(job.customerPricePence)}
              </span>
            ),
          },
        ]}
      />
      <Pagination
        page={filters.page}
        totalPages={totalPages}
        totalDocs={totalDocs}
        pageSize={PAGE_SIZE}
        hrefFor={(page) => jobsHref(filters, { page })}
      />
    </>
  );
}

function DayRow({ job, now }: { job: Job; now: Date }) {
  const urgent = isUrgent(job, now);
  return (
    <li>
      <Link
        href={`/admin/jobs/${job.id}`}
        className={cx(
          "hover:bg-sunken/60 grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-l-2 px-4 py-3 md:grid-cols-[72px_minmax(0,1.2fr)_minmax(0,1.5fr)_auto]",
          urgent ? "border-l-danger bg-danger-soft/40" : "border-l-transparent",
        )}
      >
        <span className="text-ink text-lg font-semibold tabular-nums">
          {clock(new Date(job.pickupAt))}
        </span>
        <div className="min-w-0">
          <p className="text-ink truncate font-medium">
            {job.nameBoardText || job.leadName}
          </p>
          <p className="text-ink-3 text-xs">
            {job.reference} · {vehicleClassName(job.vehicleClassSlug)} · {job.passengers}{" "}
            pax
            {job.flightNumber ? ` · ${job.flightNumber}` : ""}
          </p>
        </div>
        <Route
          from={job.pickupAddress}
          to={job.dropoffAddress}
          className="col-span-2 md:col-span-1"
        />
        <div className="col-span-2 flex flex-wrap items-start gap-1 md:col-span-1 md:flex-col md:items-end">
          <JobStatusBadge status={job.status} />
          {urgent ? <UrgentBadge pickupAt={job.pickupAt} now={now} /> : null}
          {job.isTest ? <TestBadge /> : null}
        </div>
      </Link>
    </li>
  );
}

function DateNav({ filters }: { filters: JobFilters }) {
  const step = filters.view === "week" ? 7 : 1;
  const today = londonDay();
  const unit = filters.view === "week" ? "week" : "day";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={jobsHref(filters, { date: addDays(filters.date, -step) })}
        className={buttonClass("secondary", "sm")}
        aria-label={`Previous ${unit}`}
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </Link>
      <Link
        href={jobsHref(filters, { date: today })}
        className={buttonClass("secondary", "sm")}
      >
        {filters.view === "week" ? "This week" : "Today"}
      </Link>
      <Link
        href={jobsHref(filters, { date: addDays(filters.date, step) })}
        className={buttonClass("secondary", "sm")}
        aria-label={`Next ${unit}`}
      >
        <ChevronRight aria-hidden className="h-4 w-4" />
      </Link>
      <span className="text-md text-ink ml-1 font-semibold">
        {filters.view === "week"
          ? `Week of ${dayHeading(mondayOf(filters.date))}`
          : dayHeading(filters.date)}
      </span>
    </div>
  );
}

function WeekView({
  jobs,
  now,
  filters,
}: {
  jobs: Job[];
  now: Date;
  filters: JobFilters;
}) {
  const monday = mondayOf(filters.date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const byDay = new Map<string, Job[]>(days.map((day) => [day, []]));
  for (const job of jobs) byDay.get(londonDay(new Date(job.pickupAt)))?.push(job);
  const today = londonDay(now);

  return (
    <div className="divide-line grid grid-cols-1 divide-y xl:grid-cols-7 xl:divide-x xl:divide-y-0">
      {days.map((day) => {
        const dayJobs = byDay.get(day) ?? [];
        const [, , dd] = day.split("-");
        return (
          <section
            key={day}
            aria-label={dayHeading(day)}
            className={cx("min-w-0", day === today && "bg-accent-soft/40")}
          >
            <header className="flex items-baseline justify-between gap-2 px-3 py-2">
              <Link
                href={jobsHref(filters, { view: "day", date: day })}
                className="text-ink text-sm font-semibold hover:underline"
              >
                {shortDay(new Date(`${day}T12:00:00Z`)).split(" ")[0]} {Number(dd)}
              </Link>
              <span className="text-ink-3 text-xs">{dayJobs.length || ""}</span>
            </header>
            {dayJobs.length === 0 ? (
              <p className="text-ink-4 px-3 pb-3 text-xs">No jobs</p>
            ) : (
              <ul className="flex flex-col gap-1.5 px-2 pb-3">
                {dayJobs.map((job) => {
                  const urgent = isUrgent(job, now);
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/admin/jobs/${job.id}`}
                        className={cx(
                          "hover:border-line-strong block rounded-md border px-2 py-1.5 text-xs",
                          urgent
                            ? "border-danger-line bg-danger-soft"
                            : "border-line bg-surface",
                        )}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-ink font-semibold tabular-nums">
                            {clock(new Date(job.pickupAt))}
                          </span>
                          <JobStatusBadge status={job.status} />
                        </span>
                        <span className="text-ink-2 mt-0.5 block truncate font-medium">
                          {job.nameBoardText || job.leadName}
                        </span>
                        <span className="text-ink-3 block truncate">
                          {job.pickupAddress}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export async function JobsView(props: AdminViewServerProps) {
  const context = requireStaff(props, "jobs.view", "/admin/jobs");
  if (context.denied) {
    return (
      <div className="ops-root min-h-dvh p-4">
        <NoAccess reason={context.reason} />
      </div>
    );
  }
  const { user, payload } = context;
  const now = new Date();
  const filters = parseJobFilters(props.searchParams, now);

  let result: { docs: Job[]; totalDocs: number; totalPages: number } | null = null;
  let failed = false;
  try {
    const found = await payload.find({
      collection: "jobs",
      where: buildJobsWhere(filters, now),
      sort: jobsSort(filters),
      depth: filters.view === "list" ? 1 : 0,
      ...(filters.view === "list"
        ? { limit: PAGE_SIZE, page: filters.page }
        : { limit: 1000, pagination: false }),
      user,
      overrideAccess: false,
    });
    result = {
      docs: found.docs,
      totalDocs: found.totalDocs,
      totalPages: found.totalPages,
    };
  } catch (error) {
    console.error("[admin/jobs] could not load jobs", error);
    failed = true;
  }

  const filtered = Boolean(
    filters.q ||
    filters.status ||
    filters.source ||
    filters.vehicle ||
    filters.unassigned,
  );

  return (
    <OpsShell user={user} active="jobs">
      <PageHeader
        title="Jobs"
        description="Every job from every source — the booking register TfL inspects."
        actions={<ViewTabs filters={filters} />}
      />

      <Panel bodyClassName="p-0">
        <Filters filters={filters} />
        {filters.view !== "list" ? (
          <div className="border-line border-b px-4 py-3">
            <DateNav filters={filters} />
          </div>
        ) : null}

        {failed || !result ? (
          <div className="p-4">
            <ErrorState
              title="Unable to load jobs"
              description="The database did not answer. Try again in a moment."
              retryHref={jobsHref(filters)}
            />
          </div>
        ) : result.docs.length === 0 ? (
          <EmptyState
            title={
              filters.view === "day"
                ? "No jobs found for this date"
                : filters.view === "week"
                  ? "No jobs this week"
                  : filtered
                    ? "No jobs match these filters"
                    : "No upcoming jobs"
            }
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : filters.includeTest
                  ? undefined
                  : "Test bookings are hidden. Tick “Show test bookings” to include them."
            }
            action={
              filtered ? (
                <Link
                  href={jobsHref({
                    ...filters,
                    q: "",
                    status: "",
                    source: "",
                    vehicle: "",
                    unassigned: false,
                    page: 1,
                  })}
                  className={buttonClass("secondary", "sm")}
                >
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : filters.view === "list" ? (
          <ListView
            jobs={result.docs}
            now={now}
            filters={filters}
            totalDocs={result.totalDocs}
            totalPages={result.totalPages}
          />
        ) : filters.view === "day" ? (
          <ul className="divide-line divide-y">
            {result.docs.map((job) => (
              <DayRow key={job.id} job={job} now={now} />
            ))}
          </ul>
        ) : (
          <WeekView jobs={result.docs} now={now} filters={filters} />
        )}
      </Panel>
    </OpsShell>
  );
}
