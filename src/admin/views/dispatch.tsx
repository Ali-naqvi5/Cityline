import {
  AlertTriangle,
  MessageCircle,
  Plane,
  Plus,
  UserPlus,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { loadBoardJobs } from "@/admin/data/dispatch";
import {
  addDays,
  clock,
  dayHeading,
  londonDay,
  londonDayBounds,
  relative,
} from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import { FilterForm } from "@/components/ops/filter-form";
import { Checkbox, Label, Select } from "@/components/ops/form-controls";
import { isUrgent, JobStatusBadge, Route, TestBadge } from "@/components/ops/jobs";
import { Badge, ButtonLink, cx, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { relId } from "@/domain/dispatch/assignment";
import { vehicleClassName } from "@/domain/jobs/labels";
import { can } from "@/domain/staff/permissions";
import type { Driver, Job } from "@/payload-types";

/**
 * The dispatch board (spec §18): open jobs in pickup order, by London day,
 * each showing what a controller decides on — time, passenger, route, flight,
 * class, driver, status. Unassigned jobs inside 24 hours stand out, and so do
 * jobs whose pickup has passed but which nobody has closed.
 */

const RANGES = {
  next24: "Next 24 hours",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
} as const;
type Range = keyof typeof RANGES;

function rangeFor(range: Range, now: Date): { from: Date; to: Date } {
  const today = londonDay(now);
  const day = (date: string) => {
    const { start, end } = londonDayBounds(date);
    return { from: start, to: end };
  };
  switch (range) {
    case "today":
      return day(today);
    case "tomorrow":
      return day(addDays(today, 1));
    case "week":
      return {
        from: londonDayBounds(today).start,
        to: londonDayBounds(addDays(today, 7)).start,
      };
    default:
      return { from: now, to: new Date(now.getTime() + 86_400_000) };
  }
}

const STATUS_EDGE: Record<string, string> = {
  unassigned: "border-l-warn",
  assigned: "border-l-accent",
  driver_confirmed: "border-l-ok",
};

const MESSAGE_LABEL: Record<string, string> = {
  not_sent: "Not sent",
  sent: "Opened",
  delivered: "Delivered",
  read: "Read",
  failed: "Not delivered",
};

function BoardCard({
  job,
  now,
  dispatches,
}: {
  job: Job;
  now: Date;
  dispatches: boolean;
}) {
  const at = new Date(job.pickupAt);
  const urgent = isUrgent(job, now);
  const passed = at.getTime() < now.getTime();
  const driver = typeof job.driver === "object" ? (job.driver as Driver | null) : null;

  return (
    <li
      className={cx(
        "border-line bg-surface relative flex flex-col gap-3 rounded-md border border-l-4 p-3 shadow-xs md:flex-row md:items-center md:gap-5",
        urgent ? "border-l-danger bg-danger-soft/40" : (STATUS_EDGE[job.status] ?? ""),
      )}
    >
      <div className="flex items-start justify-between gap-3 md:w-28 md:shrink-0 md:flex-col md:justify-start md:gap-1">
        <p className="text-ink text-xl leading-none font-semibold tabular-nums">
          {clock(at)}
        </p>
        <p
          className={cx(
            "text-xs",
            urgent || passed ? "text-danger font-medium" : "text-ink-3",
          )}
        >
          {passed ? `Passed ${relative(at, now)}` : relative(at, now)}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/jobs/${job.id}`}
            className="text-ink text-base font-semibold after:absolute after:inset-0 hover:underline"
          >
            {job.nameBoardText || job.leadName}
          </Link>
          <span className="text-ink-3 text-xs">{job.reference}</span>
          {job.isTest ? <TestBadge /> : null}
        </p>
        <Route from={job.pickupAddress} to={job.dropoffAddress} />
        <p className="text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {job.flightNumber ? (
            <span className="inline-flex items-center gap-1">
              <Plane aria-hidden className="h-3 w-3" />
              {job.flightNumber}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <UsersRound aria-hidden className="h-3 w-3" />
            {job.passengers} · {vehicleClassName(job.vehicleClassSlug)}
          </span>
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-1 md:w-52 md:shrink-0">
        {driver ? (
          <>
            <p className="text-ink truncate text-sm font-medium">{driver.fullName}</p>
            <p className="text-ink-3 flex items-center gap-2 text-xs">
              <span className="tabular-nums">{job.vehicleReg}</span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle aria-hidden className="h-3 w-3" />
                {MESSAGE_LABEL[job.driverMessageStatus] ?? job.driverMessageStatus}
              </span>
            </p>
          </>
        ) : (
          <p className={cx("text-sm font-medium", urgent ? "text-danger" : "text-warn")}>
            No driver
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 md:w-48 md:shrink-0 md:justify-end">
        <JobStatusBadge status={job.status} />
        {dispatches && !relId(job.driver) ? (
          <ButtonLink
            href={`/admin/jobs/${job.id}/assign`}
            size="sm"
            variant={urgent ? "danger" : "primary"}
            className="relative z-10"
          >
            <UserPlus aria-hidden className="h-4 w-4" />
            Assign
          </ButtonLink>
        ) : null}
      </div>
    </li>
  );
}

function groupByDay(jobs: Job[]): [string, Job[]][] {
  const days = new Map<string, Job[]>();
  for (const job of jobs) {
    const day = londonDay(new Date(job.pickupAt));
    days.set(day, [...(days.get(day) ?? []), job]);
  }
  return [...days.entries()];
}

export async function DispatchView(props: AdminViewServerProps) {
  const context = requireStaff(props, "jobs.dispatch", "/admin/dispatch");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const rangeParam = param(props.searchParams, "range");
  const range: Range = rangeParam in RANGES ? (rangeParam as Range) : "next24";
  const onlyUnassigned = param(props.searchParams, "unassigned") === "1";
  const { upcoming, overdue } = await loadBoardJobs(
    payload,
    user,
    rangeFor(range, now),
    onlyUnassigned,
    now,
  );

  const urgent = [...overdue, ...upcoming].filter((job) => isUrgent(job, now));
  const needDriver = upcoming.filter((job) => job.status === "unassigned").length;
  const dispatches = can(user.role, "jobs.dispatch");

  return (
    <OpsShell user={user} active="dispatch">
      <PageHeader
        title="Dispatch"
        description="Open jobs in pickup order. Assign a driver, then send them the job on WhatsApp."
        actions={
          can(user.role, "jobs.edit") ? (
            <ButtonLink href="/admin/jobs/new" variant="primary">
              <Plus aria-hidden className="h-4 w-4" />
              New job
            </ButtonLink>
          ) : null
        }
      />

      <Panel bodyClassName="p-0" className="mb-5">
        <FilterForm
          action="/admin/dispatch"
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        >
          <div className="sm:w-56">
            <Label htmlFor="dispatch-range">Showing</Label>
            <Select id="dispatch-range" name="range" defaultValue={range}>
              {Object.entries(RANGES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox
            id="dispatch-unassigned"
            name="unassigned"
            value="1"
            defaultChecked={onlyUnassigned}
            label="Only jobs that need a driver"
          />
          <p className="text-ink-3 text-sm sm:ml-auto sm:pb-2" aria-live="polite">
            {upcoming.length} {upcoming.length === 1 ? "job" : "jobs"}
            {needDriver ? ` · ${needDriver} need a driver` : ""}
          </p>
        </FilterForm>
      </Panel>

      {urgent.length ? (
        <div
          role="alert"
          className="border-danger-line bg-danger-soft text-danger mb-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
        >
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>
              {urgent.length} {urgent.length === 1 ? "job has" : "jobs have"} no driver
            </strong>{" "}
            and {urgent.length === 1 ? "is" : "are"} due within 24 hours.
          </span>
        </div>
      ) : null}

      {overdue.length ? (
        <section className="mb-6" aria-labelledby="dispatch-overdue">
          <h2
            id="dispatch-overdue"
            className="text-danger mb-2 flex items-center gap-2 text-sm font-semibold"
          >
            Pickup passed — still open
            <Badge tone="danger">{overdue.length}</Badge>
          </h2>
          <p className="text-ink-3 mb-3 text-sm">
            Mark each one completed, no-show or cancelled so the register is right.
          </p>
          <ul className="flex flex-col gap-2">
            {overdue.map((job) => (
              <BoardCard key={job.id} job={job} now={now} dispatches={dispatches} />
            ))}
          </ul>
        </section>
      ) : null}

      {upcoming.length === 0 ? (
        <Panel>
          <EmptyState
            title={onlyUnassigned ? "Every job has a driver" : "No jobs in this period"}
            description={
              onlyUnassigned
                ? `Nothing in "${RANGES[range]}" is waiting for a driver.`
                : `Nothing is booked for "${RANGES[range]}". Try a longer period.`
            }
          />
        </Panel>
      ) : (
        groupByDay(upcoming).map(([day, jobs]) => (
          <section key={day} className="mb-6" aria-labelledby={`day-${day}`}>
            <h2
              id={`day-${day}`}
              className="text-ink mb-2 flex items-center gap-2 text-sm font-semibold"
            >
              {dayHeading(day)}
              <span className="text-ink-3 font-normal">
                {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {jobs.map((job) => (
                <BoardCard key={job.id} job={job} now={now} dispatches={dispatches} />
              ))}
            </ul>
          </section>
        ))
      )}
    </OpsShell>
  );
}
