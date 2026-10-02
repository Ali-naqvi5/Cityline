import {
  AlertTriangle,
  Ban,
  Briefcase,
  Building2,
  Car,
  CheckCircle2,
  CircleDashed,
  CircleEllipsis,
  FlaskConical,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  UserCheck,
  UserX,
  UsersRound,
} from "lucide-react";

import { clock, relative, shortDay } from "@/admin/format";
import {
  JOB_SOURCE_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUS_SHORT,
  isJobSource,
  isJobStatus,
  vehicleClassName,
  type JobSource,
  type JobStatus,
} from "@/domain/jobs/labels";
import type { Job } from "@/payload-types";

import { Badge, cx } from "./primitives";

const ICON = "h-3.5 w-3.5";

/**
 * One colour per stage of the cycle, always with its name beside it (§53):
 * the colour helps a controller scan the board, the text says what it is.
 */
export const STATUS_COLOURS: Record<JobStatus, string> = {
  unassigned: "border-warn-line bg-warn-soft text-warn",
  assigned: "border-accent-line bg-accent-soft text-accent",
  driver_confirmed: "border-cat-6-line bg-cat-6-soft text-cat-6",
  on_the_way: "border-cat-1-line bg-cat-1-soft text-cat-1",
  at_pickup: "border-cat-5-line bg-cat-5-soft text-cat-5",
  on_board: "border-special-line bg-special-soft text-special",
  completed: "border-ok-line bg-ok-soft text-ok",
  no_show: "border-cat-4-line bg-cat-4-soft text-cat-4",
  cancelled: "border-line bg-sunken text-ink-2",
};

const STATUS_ICON: Record<JobStatus, React.ReactNode> = {
  unassigned: <CircleDashed aria-hidden className={ICON} />,
  assigned: <UserCheck aria-hidden className={ICON} />,
  driver_confirmed: <UserCheck aria-hidden className={ICON} />,
  on_the_way: <Car aria-hidden className={ICON} />,
  at_pickup: <MapPin aria-hidden className={ICON} />,
  on_board: <UsersRound aria-hidden className={ICON} />,
  completed: <CheckCircle2 aria-hidden className={ICON} />,
  no_show: <UserX aria-hidden className={ICON} />,
  cancelled: <Ban aria-hidden className={ICON} />,
};

/**
 * A job's stage. `short` shows the office's codes (DOW, DAP, POB, PNS) for
 * tables and the board; screen readers always hear the full name.
 */
export function JobStatusBadge({ status, short }: { status: string; short?: boolean }) {
  if (!isJobStatus(status)) return <Badge>{status}</Badge>;
  const long = JOB_STATUS_LABELS[status];
  const code = JOB_STATUS_SHORT[status];
  const showShort = short && code !== long;
  return (
    <span
      title={long}
      className={cx(
        "relative inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-xs leading-4 font-medium whitespace-nowrap",
        STATUS_COLOURS[status],
      )}
    >
      {STATUS_ICON[status]}
      {showShort ? (
        <>
          <span aria-hidden>{code}</span>
          <span className="sr-only">{long}</span>
        </>
      ) : code !== long && code !== "Confirmed" ? (
        `${code} · ${long}`
      ) : (
        long
      )}
    </span>
  );
}

const SOURCE_ICON: Record<JobSource, React.ReactNode> = {
  website: <Globe aria-hidden className={ICON} />,
  supplier: <Building2 aria-hidden className={ICON} />,
  phone: <Phone aria-hidden className={ICON} />,
  whatsapp: <MessageCircle aria-hidden className={ICON} />,
  email: <Mail aria-hidden className={ICON} />,
  account: <Briefcase aria-hidden className={ICON} />,
  other: <CircleEllipsis aria-hidden className={ICON} />,
};

/** Website bookings stand out (spec §15): their price and route are locked. */
export function SourceBadge({ source }: { source: string }) {
  if (!isJobSource(source)) return <Badge>{source}</Badge>;
  return (
    <Badge tone={source === "website" ? "info" : "neutral"} icon={SOURCE_ICON[source]}>
      {source === "website" ? "Website booking" : JOB_SOURCE_LABELS[source]}
    </Badge>
  );
}

export function TestBadge() {
  return (
    <Badge tone="special" icon={<FlaskConical aria-hidden className={ICON} />}>
      Test
    </Badge>
  );
}

const DAY_MS = 86_400_000;

/** An unassigned job whose pickup is within 24 hours — or already past. */
export function isUrgent(job: Pick<Job, "status" | "pickupAt">, now: Date): boolean {
  if (job.status !== "unassigned") return false;
  return new Date(job.pickupAt).getTime() - now.getTime() < DAY_MS;
}

export function UrgentBadge({ pickupAt, now }: { pickupAt: string; now: Date }) {
  return (
    <Badge tone="danger" icon={<AlertTriangle aria-hidden className={ICON} />}>
      {new Date(pickupAt).getTime() < now.getTime()
        ? "Overdue — no driver"
        : `Due ${relative(new Date(pickupAt), now)}`}
    </Badge>
  );
}

export function Route({
  from,
  to,
  className,
}: {
  from: string;
  to?: string | null;
  className?: string;
}) {
  return (
    <p className={cx("text-ink-2 min-w-0 text-sm", className)}>
      <span className="block truncate">{from}</span>
      <span className="text-ink-3 block truncate">→ {to || "As directed"}</span>
    </p>
  );
}

/** A job as a card, for phones (spec §45): time, passenger, route, driver, status. */
export function JobCard({ job, now }: { job: Job; now: Date }) {
  const at = new Date(job.pickupAt);
  const urgent = isUrgent(job, now);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-ink text-lg font-semibold tabular-nums">
            {clock(at)}{" "}
            <span className="text-ink-3 text-sm font-normal">{shortDay(at)}</span>
          </p>
          <p className="text-ink text-base font-medium">
            {job.nameBoardText || job.leadName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <JobStatusBadge status={job.status} />
          {job.isTest ? <TestBadge /> : null}
        </div>
      </div>
      <Route from={job.pickupAddress} to={job.dropoffAddress} />
      <div className="text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-ink-2 font-medium">{job.reference}</span>
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
        <span>{job.vehicleReg ? `Vehicle ${job.vehicleReg}` : "No driver yet"}</span>
      </div>
      {urgent ? <UrgentBadge pickupAt={job.pickupAt} now={now} /> : null}
    </div>
  );
}
