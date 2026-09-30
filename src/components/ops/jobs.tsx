import {
  AlertTriangle,
  Ban,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleDashed,
  CircleEllipsis,
  FlaskConical,
  Globe,
  Mail,
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
  isJobSource,
  isJobStatus,
  vehicleClassName,
  type JobSource,
  type JobStatus,
} from "@/domain/jobs/labels";
import type { Job } from "@/payload-types";

import { Badge, cx, type Tone } from "./primitives";

const ICON = "h-3.5 w-3.5";

const STATUS_STYLE: Record<JobStatus, { tone: Tone; icon: React.ReactNode }> = {
  unassigned: { tone: "warn", icon: <CircleDashed aria-hidden className={ICON} /> },
  assigned: { tone: "info", icon: <UserCheck aria-hidden className={ICON} /> },
  driver_confirmed: { tone: "special", icon: <UserCheck aria-hidden className={ICON} /> },
  completed: { tone: "ok", icon: <CheckCircle2 aria-hidden className={ICON} /> },
  no_show: { tone: "danger", icon: <UserX aria-hidden className={ICON} /> },
  cancelled: { tone: "neutral", icon: <Ban aria-hidden className={ICON} /> },
};

export function JobStatusBadge({ status }: { status: string }) {
  if (!isJobStatus(status)) return <Badge>{status}</Badge>;
  const { tone, icon } = STATUS_STYLE[status];
  return (
    <Badge tone={tone} icon={icon}>
      {JOB_STATUS_LABELS[status]}
    </Badge>
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
