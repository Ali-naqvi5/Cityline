import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CircleDashed,
  Globe,
  Info,
  ListChecks,
  PoundSterling,
} from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";
import type { ReactNode } from "react";

import { loadDashboard, type DashboardData } from "@/admin/data/dashboard";
import {
  dayHeading,
  londonDay,
  money,
  pickupLabel,
  relative,
  stamp,
} from "@/admin/format";
import { requireStaff } from "@/admin/guard";
import { DataTable } from "@/components/ops/data-table";
import { JobCard, JobStatusBadge, Route } from "@/components/ops/jobs";
import {
  ButtonLink,
  cx,
  MetricCard,
  NotRecorded,
  PageHeader,
  Panel,
  type Tone,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { EmptyState, NoAccess } from "@/components/ops/states";
import { vehicleClassName } from "@/domain/jobs/labels";
import type { Role } from "@/domain/staff/permissions";
import type { Job } from "@/payload-types";

/**
 * The dashboard (spec §8): "what needs my attention right now?", shaped by
 * role. Owner sees everything; Controller the day's work; Accounts the money;
 * Editor the content work.
 */

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function AlertRow({
  tone,
  icon,
  title,
  detail,
  href,
}: {
  tone: Tone;
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const accent: Record<Tone, string> = {
    danger: "border-l-danger",
    warn: "border-l-warn",
    info: "border-l-accent",
    ok: "border-l-ok",
    special: "border-l-special",
    neutral: "border-l-line-strong",
  };
  const iconTone: Record<Tone, string> = {
    danger: "text-danger",
    warn: "text-warn",
    info: "text-accent",
    ok: "text-ok",
    special: "text-special",
    neutral: "text-ink-3",
  };
  const body = (
    <div className={cx("flex gap-3 border-l-2 py-2.5 pr-3 pl-3", accent[tone])}>
      <span className={cx("mt-0.5", iconTone[tone])}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-medium">{title}</p>
        {detail ? <p className="text-ink-3 text-xs">{detail}</p> : null}
      </div>
    </div>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="hover:bg-sunken/60 block">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

function AlertsPanel({ data, role }: { data: DashboardData; role: Role }) {
  const urgent = data.jobs?.urgent ?? [];
  const recent = data.bookings?.recent ?? [];
  const cancelled = data.bookings?.cancelledThisWeek ?? [];
  const count = urgent.length + recent.length + cancelled.length;

  return (
    <Panel
      id="alerts"
      title="Needs attention"
      description={
        count ? `${count} item${count === 1 ? "" : "s"}` : "Nothing waiting on you"
      }
      bodyClassName="p-0"
    >
      {count === 0 ? (
        <EmptyState
          title="All clear"
          description="No unassigned pickups in the next 24 hours, and no new bookings or cancellations to look at."
        />
      ) : (
        <ul className="divide-line divide-y">
          {urgent.map((job) => {
            const at = new Date(job.pickupAt);
            const overdue = at.getTime() < data.now.getTime();
            return (
              <AlertRow
                key={`job-${job.id}`}
                tone="danger"
                icon={<AlertTriangle aria-hidden className="h-4 w-4" />}
                title={`${job.reference} is unassigned — pickup ${relative(at, data.now)}`}
                detail={`${overdue ? "Overdue. " : ""}${pickupLabel(at)} · ${job.nameBoardText || job.leadName} · ${job.pickupAddress}`}
                href={`/admin/jobs/${job.id}`}
              />
            );
          })}
          {recent.map((booking) => (
            <AlertRow
              key={`booking-${booking.id}`}
              tone="info"
              icon={<Globe aria-hidden className="h-4 w-4" />}
              title={`New website booking ${booking.reference}`}
              detail={`${money(booking.totalPence)} · booked ${stamp(new Date(booking.createdAt))}`}
              href={`/admin/jobs?q=${encodeURIComponent(booking.reference)}&when=all`}
            />
          ))}
          {cancelled.map((booking) => (
            <AlertRow
              key={`cancel-${booking.id}`}
              tone="neutral"
              icon={<Ban aria-hidden className="h-4 w-4" />}
              title={`Booking ${booking.reference} was cancelled`}
              detail={`${booking.cancelReason || "No reason recorded"} · ${booking.cancelledAt ? stamp(new Date(booking.cancelledAt)) : ""}`}
              href={`/admin/jobs?q=${encodeURIComponent(booking.reference)}&when=all`}
            />
          ))}
        </ul>
      )}
      {role === "owner" || role === "controller" ? (
        <p className="border-line text-ink-3 flex items-start gap-2 border-t px-4 py-2.5 text-xs">
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Document expiry and failed-message alerts appear here once drivers, vehicles and
          messaging are set up.
        </p>
      ) : null}
    </Panel>
  );
}

function UpcomingPanel({ jobs, now }: { jobs: Job[]; now: Date }) {
  return (
    <Panel
      title="Next pickups"
      actions={
        <ButtonLink href="/admin/jobs" size="sm" variant="ghost">
          All jobs
        </ButtonLink>
      }
      bodyClassName="p-0"
    >
      {jobs.length === 0 ? (
        <EmptyState
          icon={<CalendarDays aria-hidden className="h-5 w-5" />}
          title="No upcoming pickups"
          description="Jobs from the website and from staff appear here as soon as they are booked."
        />
      ) : (
        <DataTable
          caption="Next pickups"
          rows={jobs}
          rowKey={(job) => job.id}
          rowHref={(job) => `/admin/jobs/${job.id}`}
          card={(job) => <JobCard job={job} now={now} />}
          columns={[
            {
              key: "time",
              header: "Pickup",
              cell: (job) => (
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="text-ink font-medium whitespace-nowrap tabular-nums hover:underline"
                >
                  {pickupLabel(new Date(job.pickupAt))}
                  <span className="text-ink-3 block text-xs font-normal">
                    {relative(new Date(job.pickupAt), now)}
                  </span>
                </Link>
              ),
            },
            {
              key: "passenger",
              header: "Passenger",
              cell: (job) => (
                <>
                  <span className="text-ink font-medium">
                    {job.nameBoardText || job.leadName}
                  </span>
                  <span className="text-ink-3 block text-xs">{job.reference}</span>
                </>
              ),
            },
            {
              key: "route",
              header: "Route",
              cell: (job) => (
                <Route
                  from={job.pickupAddress}
                  to={job.dropoffAddress}
                  className="max-w-72"
                />
              ),
            },
            {
              key: "vehicle",
              header: "Vehicle",
              hideBelow: "xl",
              cell: (job) => (
                <span className="text-ink-2">
                  {vehicleClassName(job.vehicleClassSlug)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (job) => <JobStatusBadge status={job.status} />,
            },
          ]}
        />
      )}
    </Panel>
  );
}

function MoneyPanel({ money: figures }: { money: NonNullable<DashboardData["money"]> }) {
  const net = figures.revenuePence - figures.refundsPence - figures.feesPence;
  return (
    <Panel
      title={`Money · ${figures.monthLabel}`}
      description="Website payments, test bookings excluded"
    >
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <dt className="text-ink-3 text-xs">Taken</dt>
          <dd className="text-ink text-xl font-semibold tabular-nums">
            {money(figures.revenuePence)}
          </dd>
          <dd className="text-ink-3 text-xs">{figures.paymentsCount} payments</dd>
        </div>
        <div>
          <dt className="text-ink-3 text-xs">Refunded</dt>
          <dd className="text-ink text-xl font-semibold tabular-nums">
            {money(figures.refundsPence)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3 text-xs">Card fees</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {figures.feesPence > 0 ? money(figures.feesPence) : <NotRecorded />}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3 text-xs">Net revenue</dt>
          <dd className="text-ink text-xl font-semibold tabular-nums">{money(net)}</dd>
          {figures.feesPence === 0 ? (
            <dd className="text-ink-3 text-xs">Before card fees</dd>
          ) : null}
        </div>
      </dl>
      <p className="border-line text-ink-3 mt-4 flex items-start gap-2 border-t pt-3 text-xs">
        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Profit, driver pay owed and supplier money owed are tracked once driver pay and
        supplier records are in the system.
      </p>
    </Panel>
  );
}

export async function DashboardView(props: AdminViewServerProps) {
  const context = requireStaff(props, "dashboard", "/admin/dashboard");
  if (context.denied) {
    return (
      <div className="ops-root min-h-dvh p-4">
        <NoAccess reason={context.reason} />
      </div>
    );
  }

  const { user, payload } = context;
  const data = await loadDashboard(payload, user);
  const firstName = (user.name || "").split(" ")[0];

  return (
    <OpsShell user={user} active="dashboard">
      <PageHeader
        eyebrow={dayHeading(londonDay(data.now))}
        title={`${greeting(data.now)}${firstName ? `, ${firstName}` : ""}`}
        actions={
          data.jobs ? (
            <ButtonLink href="/admin/jobs?view=day" variant="primary">
              <ListChecks aria-hidden className="h-4 w-4" />
              Today&apos;s jobs
            </ButtonLink>
          ) : null
        }
      />

      {user.role === "editor" ? (
        <Panel title="Website content">
          <p className="text-ink-2 text-base">
            Editing pages and media from the admin is being built. Until then, content
            changes go through the development team.
          </p>
          <ButtonLink href="/" className="mt-4" size="sm">
            View the website
          </ButtonLink>
        </Panel>
      ) : (
        <div className="flex flex-col gap-5">
          {data.jobs || data.money ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {user.role === "accounts" && data.money ? (
                <MetricCard
                  label={`Taken in ${data.money.monthLabel.split(" ")[0]}`}
                  value={money(data.money.revenuePence)}
                  icon={<PoundSterling aria-hidden className="h-4 w-4" />}
                />
              ) : null}
              {data.jobs ? (
                <>
                  <MetricCard
                    label="Jobs today"
                    value={data.jobs.today}
                    href="/admin/jobs?view=day"
                    icon={<CalendarDays aria-hidden className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Jobs this week"
                    value={data.jobs.thisWeek}
                    href="/admin/jobs?view=week"
                    icon={<ListChecks aria-hidden className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Unassigned"
                    value={data.jobs.unassigned}
                    tone={
                      data.jobs.urgent.length
                        ? "danger"
                        : data.jobs.unassigned
                          ? "warn"
                          : undefined
                    }
                    hint={
                      data.jobs.urgent.length
                        ? `${data.jobs.urgent.length} within 24 hours`
                        : "None within 24 hours"
                    }
                    href="/admin/jobs?unassigned=1"
                    icon={<CircleDashed aria-hidden className="h-4 w-4" />}
                  />
                </>
              ) : null}
              {user.role === "owner" && data.money ? (
                <MetricCard
                  label={`Taken in ${data.money.monthLabel.split(" ")[0]}`}
                  value={money(data.money.revenuePence)}
                  hint={`${money(data.money.revenuePence - data.money.refundsPence)} after refunds`}
                  icon={<PoundSterling aria-hidden className="h-4 w-4" />}
                />
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="flex min-w-0 flex-col gap-5">
              {user.role === "accounts" && data.money ? (
                <MoneyPanel money={data.money} />
              ) : null}
              {data.jobs ? (
                <UpcomingPanel jobs={data.jobs.upcoming} now={data.now} />
              ) : null}
              {user.role === "owner" && data.money ? (
                <MoneyPanel money={data.money} />
              ) : null}
            </div>
            <div className="min-w-0">
              <AlertsPanel data={data} role={user.role} />
            </div>
          </div>
        </div>
      )}
    </OpsShell>
  );
}
