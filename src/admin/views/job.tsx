import { ArrowLeft, CheckCircle2, Lock, Mail, Printer, XCircle } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { resendManageLinkAction } from "@/admin/actions/jobs";
import { money, pickupLabel, relative, stamp } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import { PrintButton } from "@/components/ops/filter-form";
import {
  isUrgent,
  JobStatusBadge,
  SourceBadge,
  TestBadge,
  UrgentBadge,
} from "@/components/ops/jobs";
import {
  Badge,
  buttonClass,
  ButtonLink,
  cx,
  Field,
  Fields,
  NotRecorded,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { EmptyState, NoAccess } from "@/components/ops/states";
import { Change, Timeline, type TimelineEntry } from "@/components/ops/timeline";
import { EXTRAS } from "@/domain/pricing/extras";
import {
  isJobStatus,
  JOB_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  vehicleClassName,
} from "@/domain/jobs/labels";
import { can } from "@/domain/staff/permissions";
import type { Booking, Job, JobEvent, User } from "@/payload-types";

/**
 * One job, as a workspace (spec §11): everything a controller needs to act on
 * it, and its full history. Actions appear as they are built — nothing here is
 * a button that does not work yet.
 */

const FIELD_LABELS: Record<string, string> = {
  pickupAt: "Pickup time",
  nameBoardText: "Name board",
  leadName: "Passenger name",
  leadPhone: "Passenger phone",
  driverNotes: "Driver notes",
  flightNumber: "Flight",
  status: "Status",
};

function describeValue(
  field: string | null | undefined,
  value: string | null | undefined,
): string {
  if (!value) return "";
  if (field === "pickupAt") {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? value : pickupLabel(at);
  }
  if (field === "status" && isJobStatus(value)) return JOB_STATUS_LABELS[value];
  return value;
}

function actorName(event: JobEvent): string {
  if (event.actorType === "customer") return "Customer, via Manage booking";
  if (event.actorType === "system") return "System";
  const user =
    typeof event.actorUser === "object" ? (event.actorUser as User | null) : null;
  return user?.name || user?.email || "Staff";
}

function timelineFor(job: Job, events: JobEvent[]): TimelineEntry[] {
  const taker =
    typeof job.takenByUser === "object" ? (job.takenByUser as User | null) : null;
  const entries: TimelineEntry[] = [
    {
      id: "created",
      title: job.source === "website" ? "Booked on the website" : "Job created",
      actor: job.source === "website" ? "Website checkout" : taker?.name || "Staff",
      at: new Date(job.takenAt || job.createdAt),
      tone: "info",
    },
  ];

  for (const event of events) {
    const label = event.field ? (FIELD_LABELS[event.field] ?? event.field) : "";
    let title: string;
    let detail: React.ReactNode;
    let tone: TimelineEntry["tone"] = "neutral";

    switch (event.type) {
      case "updated":
        title = `Changed ${label.toLowerCase() || "details"}`;
        detail = (
          <Change
            from={describeValue(event.field, event.oldValue)}
            to={describeValue(event.field, event.newValue)}
          />
        );
        break;
      case "status_changed":
        title = "Status changed";
        detail = (
          <Change
            from={describeValue("status", event.oldValue)}
            to={describeValue("status", event.newValue)}
          />
        );
        tone =
          event.newValue === "cancelled"
            ? "danger"
            : event.newValue === "completed"
              ? "ok"
              : "info";
        break;
      case "assigned":
        title = "Driver assigned";
        detail = event.newValue;
        tone = "info";
        break;
      case "unassigned":
        title = "Driver removed";
        detail = event.oldValue;
        tone = "warn";
        break;
      case "message_sent":
        title = event.newValue || "Message sent";
        tone = /NOT sent/.test(event.newValue ?? "") ? "danger" : "ok";
        break;
      default:
        title = "Job created";
    }

    entries.push({
      id: event.id,
      title,
      actor: actorName(event),
      at: new Date(event.createdAt),
      detail,
      tone,
    });
  }

  return entries;
}

function extraName(slug: string): string {
  return EXTRAS.find((extra) => extra.slug === slug)?.name ?? slug;
}

const NOTICES: Record<string, { tone: "ok" | "danger"; text: string }> = {
  "link-sent": { tone: "ok", text: "Manage booking link emailed to the customer." },
  "link-failed": {
    tone: "danger",
    text: "The email could not be sent. The attempt is recorded in the history below — check the email settings.",
  },
  "no-booking": {
    tone: "danger",
    text: "This job has no website booking, so there is no link to send.",
  },
};

export async function JobView(props: AdminViewServerProps) {
  const segments = (props.params?.segments as string[] | undefined) ?? [];
  const id = Number(segments[1]);
  const context = requireStaff(props, "jobs.view", `/admin/jobs/${segments[1] ?? ""}`);
  if (context.denied) {
    return (
      <div className="ops-root min-h-dvh p-4">
        <NoAccess reason={context.reason} />
      </div>
    );
  }
  const { user, payload } = context;
  const now = new Date();

  const job = Number.isInteger(id)
    ? ((await payload.findByID({
        collection: "jobs",
        id,
        depth: 1,
        user,
        overrideAccess: false,
        disableErrors: true,
      })) as Job | null)
    : null;

  if (!job) {
    return (
      <OpsShell user={user} active="jobs">
        <Panel>
          <EmptyState
            title="No job with that number"
            description="It may have been typed wrongly, or the link is out of date."
            action={<ButtonLink href="/admin/jobs">Back to jobs</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const events = await payload.find({
    collection: "job-events",
    where: { job: { equals: job.id } },
    sort: "createdAt",
    depth: 1,
    limit: 500,
    user,
    overrideAccess: false,
  });

  const booking =
    typeof job.booking === "object" ? (job.booking as Booking | null) : null;
  const dispatcher =
    typeof job.dispatchedByUser === "object"
      ? (job.dispatchedByUser as User | null)
      : null;
  const taker =
    typeof job.takenByUser === "object" ? (job.takenByUser as User | null) : null;
  const at = new Date(job.pickupAt);
  const urgent = isUrgent(job, now);
  const notice = NOTICES[param(props.searchParams, "notice")];
  const website = job.source === "website";
  const seesFinance = can(user.role, "finance.jobs");

  const feesKnown = (job.paymentFeePence ?? 0) > 0;
  const commissionPence = 0; // Supplier commission arrives with suppliers.
  const netPence = job.customerPricePence - commissionPence - (job.paymentFeePence ?? 0);

  return (
    <OpsShell user={user} active="jobs">
      <div className="mb-3 print:hidden">
        <Link
          href="/admin/jobs"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Jobs
        </Link>
      </div>

      {notice ? (
        <div
          role="status"
          className={cx(
            "mb-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
            notice.tone === "ok"
              ? "border-ok-line bg-ok-soft text-ok"
              : "border-danger-line bg-danger-soft text-danger",
          )}
        >
          {notice.tone === "ok" ? (
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {notice.text}
        </div>
      ) : null}

      <PageHeader
        eyebrow={
          <>
            <SourceBadge source={job.source} />
            {job.isTest ? <TestBadge /> : null}
            {booking ? <span>Booking {booking.reference}</span> : null}
            {job.leg ? (
              <span>{job.leg === "return" ? "Return leg" : "Outbound leg"}</span>
            ) : null}
          </>
        }
        title={job.reference}
        meta={
          <>
            <JobStatusBadge status={job.status} />
            {urgent ? <UrgentBadge pickupAt={job.pickupAt} now={now} /> : null}
            <span className="text-ink-3 text-sm">
              Pickup {pickupLabel(at)} · {relative(at, now)}
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {website && booking && can(user.role, "bookings.amend") ? (
              <form action={resendManageLinkAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <button type="submit" className={buttonClass("secondary", "md")}>
                  <Mail aria-hidden className="h-4 w-4" />
                  Resend manage link
                </button>
              </form>
            ) : null}
            <PrintButton className={buttonClass("secondary", "md")}>
              <Printer aria-hidden className="h-4 w-4" />
              Print
            </PrintButton>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Booking"
            actions={
              website ? (
                <Badge tone="info" icon={<Lock aria-hidden className="h-3 w-3" />}>
                  Price, customer and route locked
                </Badge>
              ) : null
            }
          >
            <Fields>
              <Field label="Pickup time">
                {pickupLabel(at)}{" "}
                <span className="text-ink-3">({relative(at, now)})</span>
              </Field>
              <Field label="Vehicle class">
                {vehicleClassName(job.vehicleClassSlug)}
                {job.hours ? (
                  <span className="text-ink-3"> · {job.hours} hours</span>
                ) : null}
              </Field>
              <Field label="Pickup" wide>
                {job.pickupAddress}
              </Field>
              {job.viaStops?.length ? (
                <Field label="Stops" wide>
                  <ol className="list-decimal pl-5">
                    {job.viaStops.map((stop, index) => (
                      <li key={stop.id ?? index}>{stop.address}</li>
                    ))}
                  </ol>
                </Field>
              ) : null}
              <Field label="Drop-off" wide>
                {job.dropoffAddress || "As directed"}
              </Field>
              <Field label="Flight">{job.flightNumber || "—"}</Field>
              <Field label="Passengers and bags">
                {job.passengers} passengers · {job.largeBags} large, {job.smallBags} small
                bags
              </Field>
              <Field label="Lead passenger">
                {job.leadName}
                {job.nameBoardText && job.nameBoardText !== job.leadName ? (
                  <span className="text-ink-3 block text-sm">
                    Name board: {job.nameBoardText}
                  </span>
                ) : null}
              </Field>
              <Field label="Passenger contact">
                <a
                  href={`tel:${job.leadPhone}`}
                  className="text-accent tabular-nums hover:underline"
                >
                  {job.leadPhone}
                </a>
                {job.leadEmail ? (
                  <a
                    href={`mailto:${job.leadEmail}`}
                    className="text-accent block truncate text-sm hover:underline"
                  >
                    {job.leadEmail}
                  </a>
                ) : null}
              </Field>
              <Field label="Booker">
                {booking?.bookerName ? (
                  <>
                    {booking.bookerName}
                    <span className="text-ink-3 block text-sm">
                      {[booking.bookerPhone, booking.bookerEmail]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-3">Same as the passenger</span>
                )}
              </Field>
              <Field label="Meet and greet">
                {job.meetAndGreet ? "Yes — name board in arrivals" : "No"}
              </Field>
              <Field label="Extras" wide>
                {job.extras?.length ? (
                  <ul>
                    {job.extras.map((extra, index) => (
                      <li key={extra.id ?? index}>
                        {extra.quantity} × {extraName(extra.slug)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None"
                )}
              </Field>
              <Field label="Agreed price">
                <span className="font-semibold tabular-nums">
                  {money(job.customerPricePence)}
                </span>
              </Field>
              <Field label="Payment">
                {PAYMENT_METHOD_LABELS[job.paymentMethod] ?? job.paymentMethod}
              </Field>
            </Fields>
          </Panel>

          <Panel title="Notes">
            <Fields>
              <Field label="Notes for the driver" wide>
                {job.driverNotes ? (
                  <span className="whitespace-pre-line">{job.driverNotes}</span>
                ) : (
                  "None"
                )}
              </Field>
              <Field label="Internal notes" wide>
                {job.internalNotes ? (
                  <span className="whitespace-pre-line">{job.internalNotes}</span>
                ) : (
                  "None"
                )}
              </Field>
            </Fields>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Driver and dispatch"
            description="The TfL booking record (CMP-03)"
          >
            <Fields className="sm:grid-cols-1">
              <Field label="Driver">
                {job.driverPhvNo ? (
                  `PHV licence ${job.driverPhvNo}`
                ) : (
                  <NotRecorded>Not assigned</NotRecorded>
                )}
              </Field>
              <Field label="Vehicle registration">
                {job.vehicleReg || <NotRecorded>Not assigned</NotRecorded>}
              </Field>
              <Field label="Dispatched by">
                {dispatcher ? (
                  <>
                    {dispatcher.name}
                    {job.dispatchedAt ? (
                      <span className="text-ink-3 block text-sm">
                        {stamp(new Date(job.dispatchedAt))}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <NotRecorded>Not dispatched</NotRecorded>
                )}
              </Field>
              <Field label="Taken by">
                {website ? "The website (no staff involved)" : taker?.name || "—"}
                {job.takenAt ? (
                  <span className="text-ink-3 block text-sm">
                    {stamp(new Date(job.takenAt))}
                  </span>
                ) : null}
              </Field>
            </Fields>
            <p className="border-line text-ink-3 mt-4 border-t pt-3 text-xs">
              Assigning a driver arrives with the fleet and dispatch screens.
            </p>
          </Panel>

          {seesFinance ? (
            <Panel title="Finance">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Customer price</dt>
                  <dd className="font-medium tabular-nums">
                    {money(job.customerPricePence)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Supplier commission</dt>
                  <dd className="tabular-nums">
                    {job.source === "supplier" ? <NotRecorded /> : "£0.00 — direct"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Card fees</dt>
                  <dd className="tabular-nums">
                    {feesKnown ? `− ${money(job.paymentFeePence)}` : <NotRecorded />}
                  </dd>
                </div>
                <div className="border-line flex justify-between gap-3 border-t pt-2">
                  <dt className="text-ink font-medium">Net revenue</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(netPence)}
                    {!feesKnown ? (
                      <span className="text-ink-3 block text-right text-xs font-normal">
                        before card fees
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Driver pay</dt>
                  <dd>
                    <NotRecorded />
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Job costs</dt>
                  <dd>
                    <NotRecorded>None recorded</NotRecorded>
                  </dd>
                </div>
                <div className="border-line flex justify-between gap-3 border-t pt-2">
                  <dt className="text-ink font-medium">Profit</dt>
                  <dd className="text-right">
                    <NotRecorded>Needs driver pay</NotRecorded>
                  </dd>
                </div>
              </dl>
            </Panel>
          ) : null}

          <Panel
            title="History"
            description={`${events.docs.length + 1} ${events.docs.length === 0 ? "entry" : "entries"}`}
          >
            <Timeline entries={timelineFor(job, events.docs)} />
          </Panel>

          {can(user.role, "system.view") ? (
            <p className="text-ink-3 text-xs print:hidden">
              <Link
                href={`/admin/collections/jobs/${job.id}`}
                className="hover:underline"
              >
                Open the raw record
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
