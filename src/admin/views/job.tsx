import {
  ArrowLeft,
  Ban,
  Lock,
  Mail,
  Pencil,
  Printer,
  Repeat,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import {
  removeDriverAction,
  sendDriverDetailsAction,
  setDriverMessageStatusAction,
  setStatusAction,
} from "@/admin/actions/dispatch";
import {
  cancelWebsiteBookingAction,
  deleteWebsiteBookingAction,
  resendManageLinkAction,
} from "@/admin/actions/jobs";
import { auditValue } from "@/admin/audit-format";
import { PenaltyList } from "@/admin/components/penalty-list";
import { loadJobPayment } from "@/admin/data/payments";
import { loadJobPenalties } from "@/admin/data/supplier-money";
import { londonDay, money, pickupLabel, relative, stamp } from "@/admin/format";
import { DriverPriceForm } from "@/admin/forms/driver-price-form";
import { PenaltyForm } from "@/admin/forms/penalty-form";
import { NextStageButtons, StageProgress } from "@/admin/forms/stage-controls";
import { StepBackForm } from "@/admin/forms/step-back-form";
import { WhatsAppButton } from "@/admin/forms/whatsapp-button";
import { param, requireStaff } from "@/admin/guard";
import { ContactButtons } from "@/components/ops/contact-buttons";
import { ConfirmDialog } from "@/components/ops/dialog";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
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
  Field,
  Fields,
  NotRecorded,
  Notice,
  PageHeader,
  Panel,
  type Tone,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { EmptyState, NoAccess } from "@/components/ops/states";
import { Change, Timeline, type TimelineEntry } from "@/components/ops/timeline";
import { TRACKED_FIELDS } from "@/domain/jobs/history";
import {
  isJobStatus,
  PAYMENT_METHOD_LABELS,
  vehicleClassName,
} from "@/domain/jobs/labels";
import {
  beforeBoarding,
  isDone,
  isFinal,
  previousStages,
  stageIndex,
  stageName,
} from "@/domain/jobs/status";
import {
  driverMessage,
  messageJobFrom,
  whatsappLink,
  type DriverMessageKind,
} from "@/domain/messaging/driver-message";
import { EXTRAS } from "@/domain/pricing/extras";
import { bookingMoney } from "@/domain/finance/booking-money";
import { can } from "@/domain/staff/permissions";
import { company } from "@/lib/company";
import { driverDetailsEmailsOn } from "@/lib/features";
import type {
  Booking,
  Customer,
  Driver,
  Job,
  Operator,
  JobEvent,
  Supplier,
  User,
  Vehicle,
} from "@/payload-types";

/**
 * One job, as a workspace (spec §11): everything a controller needs to act on
 * it, and its full history. The most used path — open, assign, confirm,
 * complete — is on this page; every button here works.
 */

function describeValue(
  field: string | null | undefined,
  value: string | null | undefined,
): string {
  if (!value) return "";
  if (field === "pickupAt") {
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? value : pickupLabel(at);
  }
  if (field === "status" && isJobStatus(value)) return stageName(value);
  if (field === "vehicleClassSlug") return vehicleClassName(value);
  return auditValue(field ?? "", value) ?? "";
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
      title: job.source === "website" ? "Booked on the website" : "Booking created",
      actor: job.source === "website" ? "Website checkout" : taker?.name || "Staff",
      at: new Date(job.takenAt || job.createdAt),
      tone: "info",
    },
  ];

  for (const event of events) {
    const label = event.field ? (TRACKED_FIELDS[event.field] ?? event.field) : "";
    let title: string;
    let detail: React.ReactNode;
    let tone: TimelineEntry["tone"] = "neutral";

    switch (event.type) {
      case "updated":
        // The Owner deleting a website booking says so in plain words.
        if (event.field === "deleted") {
          title = "Booking deleted";
          detail = event.newValue?.replace(/^Booking deleted: /, "") ?? null;
          tone = "danger";
          break;
        }
        title = `Changed ${label.toLowerCase() || "details"}`;
        detail = (
          <Change
            from={describeValue(event.field, event.oldValue)}
            to={describeValue(event.field, event.newValue)}
          />
        );
        break;
      case "status_changed": {
        const back =
          isJobStatus(event.oldValue) &&
          isJobStatus(event.newValue) &&
          event.newValue !== "cancelled" &&
          stageIndex(event.newValue) < stageIndex(event.oldValue);
        title = isJobStatus(event.newValue)
          ? `${back ? "Stepped back to " : ""}${stageName(event.newValue)}`
          : `Status: ${event.newValue}`;
        // A step back says what it undid; a step forward speaks for itself.
        detail = back ? (
          <Change
            from={describeValue("status", event.oldValue)}
            to={describeValue("status", event.newValue)}
          />
        ) : undefined;
        tone = back
          ? "warn"
          : event.newValue === "cancelled" || event.newValue === "no_show"
            ? "danger"
            : event.newValue === "completed"
              ? "ok"
              : "info";
        break;
      }
      case "assigned":
        title = event.oldValue ? "Driver changed" : "Driver assigned";
        detail = event.oldValue ? (
          <>
            <Change from={event.oldValue} to={event.newValue ?? ""} />
            {event.note ? <TakenOffReason note={event.note} /> : null}
          </>
        ) : (
          event.newValue
        );
        tone = "info";
        break;
      case "unassigned":
        title = "Driver removed";
        detail = (
          <>
            {event.oldValue}
            {event.note ? <TakenOffReason note={event.note} /> : null}
          </>
        );
        tone = "warn";
        break;
      case "message_sent":
        title = event.newValue || "Message sent";
        tone = /NOT sent|not delivered/.test(event.newValue ?? "") ? "danger" : "ok";
        break;
      default:
        title = "Booking created";
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

/** Why a driver came off the booking, as the member of staff wrote it. */
function TakenOffReason({ note }: { note: string }) {
  return (
    <span className="text-ink-2 mt-0.5 block whitespace-pre-line">Reason: {note}</span>
  );
}

function extraName(slug: string): string {
  return EXTRAS.find((extra) => extra.slug === slug)?.name ?? slug;
}

const NOTICES: Record<string, { tone: "ok" | "warn" | "danger"; text: string }> = {
  "link-sent": { tone: "ok", text: "Manage booking link emailed to the customer." },
  "link-failed": {
    tone: "danger",
    text: "The email could not be sent. The attempt is recorded in the history below — check the email settings.",
  },
  "no-booking": {
    tone: "danger",
    text: "This job has no website booking, so there is no link to send.",
  },
  created: { tone: "ok", text: "Booking created." },
  saved: { tone: "ok", text: "Changes saved." },
  assigned: { tone: "ok", text: "Driver assigned. Send them the job on WhatsApp below." },
  "assigned-operator": {
    tone: "ok",
    text: "Given to the operator. Send them the job on WhatsApp below.",
  },
  "driver-removed": { tone: "ok", text: "Driver removed. The job is unassigned again." },
  "status-no_show": {
    tone: "ok",
    text: "Passenger no-show recorded. If the driver's price changes, correct it below.",
  },
  "status-cancelled": { tone: "ok", text: "Booking cancelled." },
  "order-cancelled": {
    tone: "ok",
    text: "Website booking cancelled, with every journey still to come. The customer has not been emailed. Any refund is made in Stripe, then recorded on the payment; until then it waits under Refunds.",
  },
  "details-sent": { tone: "ok", text: "Driver details emailed to the passenger." },
  "details-off": {
    tone: "warn",
    text: "Emailing passengers their driver's details is switched off.",
  },
  "driver-price": { tone: "ok", text: "Driver price saved." },
  penalty: {
    tone: "ok",
    text: "Partner penalty recorded. It comes off what the partner owes, and off profit.",
  },
  "penalty-voided": { tone: "ok", text: "Partner penalty voided." },
  "details-failed": {
    tone: "danger",
    text: "The driver details could not be emailed. The reason is in the history below.",
  },
};

const MESSAGE_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_sent: { label: "Not sent", tone: "warn" },
  sent: { label: "Opened in WhatsApp", tone: "info" },
  delivered: { label: "Delivered", tone: "info" },
  read: { label: "Read", tone: "ok" },
  failed: { label: "Not delivered", tone: "danger" },
};

const PASSENGER_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_sent: { label: "Not sent", tone: "neutral" },
  sent: { label: "Emailed", tone: "ok" },
  failed: { label: "Not sent — failed", tone: "danger" },
};

/** Who a booking's WhatsApp message goes to: its driver, or its operator. */
interface Recipient {
  id: number;
  name: string;
  phone: string;
  consent: boolean;
  operator: boolean;
  editHref: string;
}

function DriverMessage({
  job,
  to,
  kind,
  label,
  variant,
}: {
  job: Job;
  to: Recipient;
  kind: DriverMessageKind;
  label: string;
  variant?: "primary" | "secondary";
}) {
  if (!to.consent) {
    return (
      <p className="text-ink-3 text-sm">
        {to.name} has not agreed to receive jobs on WhatsApp (WA-05).{" "}
        <Link href={to.editHref} className="text-accent hover:underline">
          Record their consent
        </Link>{" "}
        to send it from here.
      </p>
    );
  }
  const text = driverMessage(kind, messageJobFrom(job), company.phone);
  return (
    <WhatsAppButton
      href={whatsappLink(to.phone, text)}
      jobId={job.id}
      driverId={to.id}
      operator={to.operator}
      kind={kind}
      label={label}
      variant={variant}
    />
  );
}

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
      <OpsShell user={user} active="bookings">
        <Panel>
          <EmptyState
            title="No booking with that number"
            description="It may have been typed wrongly, or the link is out of date."
            action={<ButtonLink href="/admin/bookings">Back to bookings</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const notice = param(props.searchParams, "notice");
  const previousId = Number(param(props.searchParams, "previous")) || null;
  const [events, returnJobs, previousDriver] = await Promise.all([
    payload.find({
      collection: "job-events",
      where: { job: { equals: job.id } },
      sort: "createdAt",
      depth: 1,
      limit: 500,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: "jobs",
      where: { returnOfJob: { equals: job.id } },
      depth: 0,
      limit: 1,
      user,
      overrideAccess: false,
    }),
    previousId && can(user.role, "jobs.dispatch")
      ? (payload.findByID({
          collection: "drivers",
          id: previousId,
          depth: 0,
          user,
          overrideAccess: false,
          disableErrors: true,
        }) as Promise<Driver | null>)
      : Promise.resolve(null),
  ]);

  const booking =
    typeof job.booking === "object" ? (job.booking as Booking | null) : null;
  const customer =
    typeof job.customer === "object" ? (job.customer as Customer | null) : null;
  const supplier =
    typeof job.supplier === "object" ? (job.supplier as Supplier | null) : null;
  const driver = typeof job.driver === "object" ? (job.driver as Driver | null) : null;
  // Or a subcontracting operator, who does it with their own driver and car.
  const operator =
    typeof job.operator === "object" ? (job.operator as Operator | null) : null;
  const recipient: Recipient | null = driver
    ? {
        id: driver.id,
        name: driver.fullName ?? "The driver",
        phone: driver.phone,
        consent: Boolean(driver.whatsappConsentAt),
        operator: false,
        editHref: `/admin/drivers/${driver.id}/edit`,
      }
    : operator
      ? {
          id: operator.id,
          name: operator.name,
          phone: operator.phone,
          consent: Boolean(operator.whatsappConsentAt),
          operator: true,
          editHref: `/admin/operators/${operator.id}/edit`,
        }
      : null;
  const vehicle =
    typeof job.vehicle === "object" ? (job.vehicle as Vehicle | null) : null;
  const outbound =
    typeof job.returnOfJob === "object" ? (job.returnOfJob as Job | null) : null;
  const returnJob = returnJobs.docs[0] ?? null;
  const dispatcher =
    typeof job.dispatchedByUser === "object"
      ? (job.dispatchedByUser as User | null)
      : null;
  const taker =
    typeof job.takenByUser === "object" ? (job.takenByUser as User | null) : null;

  const at = new Date(job.pickupAt);
  const urgent = isUrgent(job, now);
  const stageNotice = notice.startsWith("status-") ? notice.slice(7) : "";
  const message =
    NOTICES[notice] ??
    (isJobStatus(stageNotice)
      ? { tone: "ok" as const, text: `Now: ${stageName(stageNotice)}.` }
      : undefined);
  const website = job.source === "website";
  const closed = isFinal(job.status);
  const seesFinance = can(user.role, "finance.jobs");
  const dispatches = can(user.role, "jobs.dispatch");
  const edits = can(user.role, "jobs.edit");
  const status = job.status;
  const changeable = beforeBoarding(status);
  // A website booking is cancelled whole, by those who amend bookings.
  const cancelsOrder =
    website && booking?.status === "confirmed" && can(user.role, "bookings.amend");
  // A completed or PNS booking is the Owner's to change (Cityline, 13 Oct 2026).
  const changesDone = can(user.role, "jobs.editClosed");
  const loadsLegs =
    website &&
    booking &&
    !booking.archivedAt &&
    (cancelsOrder || can(user.role, "bookings.delete"));
  const orderLegs = loadsLegs
    ? ((
        await payload.find({
          collection: "jobs",
          where: { booking: { equals: booking!.id } },
          sort: "pickupAt",
          pagination: false,
          depth: 0,
          user,
          overrideAccess: false,
        })
      ).docs as Job[])
    : [];

  // The Owner deletes a website booking, before any journey on it is done.
  const deletesOrder =
    loadsLegs &&
    can(user.role, "bookings.delete") &&
    orderLegs.length > 0 &&
    !orderLegs.some((leg) => isDone(leg.status) || leg.status === "on_board");

  // Whether the customer has paid, and any refund (Payments).
  const customerPaid =
    seesFinance && can(user.role, "payments.view")
      ? await loadJobPayment(payload, user, job)
      : null;
  // A partner's penalties on this booking (Cityline, 16 Oct 2026).
  const partnerBooking = job.source === "supplier";
  const penalties =
    seesFinance && partnerBooking && can(user.role, "supplierMoney.view")
      ? await loadJobPenalties(payload, user, job.id)
      : [];
  const livePenalties = penalties.filter((penalty) => !penalty.voidedAt);
  const recordsPenalties =
    partnerBooking &&
    can(user.role, "supplierMoney.manage") &&
    (isDone(status) || status === "cancelled") &&
    !job.isTest;
  const feesKnown = (job.paymentFeePence ?? 0) > 0;
  const takings = bookingMoney({
    customerPricePence: job.customerPricePence,
    refundedPence: customerPaid?.refundedPence ?? 0,
    paymentFeePence: job.paymentFeePence,
    driverPricePence: job.driverPricePence,
    penaltyPence: livePenalties.reduce((sum, penalty) => sum + penalty.amountPence, 0),
    penaltyFromDriverPence: livePenalties.reduce(
      (sum, penalty) => sum + (penalty.driverSharePence ?? 0),
      0,
    ),
  });
  const messageStatus =
    MESSAGE_STATUS[job.driverMessageStatus] ?? MESSAGE_STATUS.not_sent!;
  const passengerStatus =
    PASSENGER_STATUS[job.passengerMessageStatus] ?? PASSENGER_STATUS.not_sent!;
  const emailedNow = param(props.searchParams, "emailed");

  return (
    <OpsShell user={user} active="bookings">
      <div className="mb-3 print:hidden">
        <Link
          href="/admin/bookings"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Bookings
        </Link>
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {job.archivedAt ? (
        <Notice tone="warn">
          This booking was deleted on {stamp(new Date(job.archivedAt))}. It is kept on
          record for TfL and the accounts, and no longer shows in operations.
        </Notice>
      ) : null}
      {notice === "assigned" && emailedNow === "0" ? (
        <Notice tone="danger">
          The passenger was not emailed the driver&apos;s details. The reason is in the
          history below.
        </Notice>
      ) : null}
      {previousDriver &&
      (notice === "assigned" ||
        notice === "driver-removed" ||
        notice === "assigned-operator") ? (
        <div className="border-warn-line bg-warn-soft mb-4 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="text-ink text-sm">
            Tell <strong>{previousDriver.fullName}</strong> the job is no longer theirs.
          </p>
          <DriverMessage
            job={job}
            to={{
              id: previousDriver.id,
              name: previousDriver.fullName ?? "The driver",
              phone: previousDriver.phone,
              consent: Boolean(previousDriver.whatsappConsentAt),
              operator: false,
              editHref: `/admin/drivers/${previousDriver.id}/edit`,
            }}
            kind="removed"
            label="Send “job removed” on WhatsApp"
            variant="secondary"
          />
        </div>
      ) : null}

      <PageHeader
        eyebrow={
          <>
            <SourceBadge source={job.source} />
            {job.isTest ? <TestBadge /> : null}
            {booking ? <span>Booking {booking.reference}</span> : null}
            {supplier ? (
              <span>
                {supplier.name} {job.supplierReference}
              </span>
            ) : null}
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
            {dispatches && !closed && !driver && !job.operator ? (
              <ButtonLink href={`/admin/jobs/${job.id}/assign`} variant="primary">
                <UserPlus aria-hidden className="h-4 w-4" />
                Assign driver
              </ButtonLink>
            ) : null}
            {edits && (!closed || (isDone(status) && changesDone)) ? (
              <ButtonLink href={`/admin/jobs/${job.id}/edit`}>
                <Pencil aria-hidden className="h-4 w-4" />
                Edit
              </ButtonLink>
            ) : null}
            {edits && !website && job.leg !== "return" && !returnJob ? (
              <ButtonLink href={`/admin/jobs/new?returnOf=${job.id}`}>
                <Repeat aria-hidden className="h-4 w-4" />
                Create return trip
              </ButtonLink>
            ) : null}
            {website &&
            booking &&
            !booking.archivedAt &&
            can(user.role, "bookings.amend") ? (
              <form action={resendManageLinkAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <button type="submit" className={buttonClass("secondary", "md")}>
                  <Mail aria-hidden className="h-4 w-4" />
                  Resend manage link
                </button>
              </form>
            ) : null}
            {deletesOrder ? (
              <ConfirmDialog
                label="Delete booking"
                icon={<Trash2 aria-hidden className="h-4 w-4" />}
                variant="ghost"
                size="md"
                title={`Delete website booking ${booking!.reference}?`}
                confirmLabel="Delete booking"
                confirmVariant="danger"
                pendingLabel="Deleting…"
                action={deleteWebsiteBookingAction}
                fields={{ jobId: job.id }}
              >
                <p>The booking is cancelled and removed from every screen and report:</p>
                <ul className="flex flex-col gap-1">
                  {orderLegs.map((leg) => (
                    <li key={leg.id} className="text-sm">
                      <span className="font-medium tabular-nums">{leg.reference}</span> ·{" "}
                      {pickupLabel(new Date(leg.pickupAt))} · from {leg.pickupAddress}
                    </li>
                  ))}
                </ul>
                <p className="text-ink-3 text-sm">
                  It is kept on record for TfL and the accounts, and its payment stays
                  under Payments, so any refund can still be made and recorded. This
                  cannot be undone here.
                </p>
                <label htmlFor="delete-order-reason" className="text-ink-2 font-medium">
                  Why is it deleted?
                </label>
                <textarea
                  id="delete-order-reason"
                  name="reason"
                  rows={2}
                  required
                  className={TEXTAREA_CLASS}
                />
              </ConfirmDialog>
            ) : null}
            <PrintButton className={buttonClass("secondary", "md")}>
              <Printer aria-hidden className="h-4 w-4" />
              Print
            </PrintButton>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
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
                {job.dropoffAddress || (job.hours ? "Hourly hire" : "As directed")}
              </Field>
              <Field label="Flight">{job.flightNumber || "—"}</Field>
              <Field label="Passengers and bags">
                {job.passengers} {job.passengers === 1 ? "passenger" : "passengers"} ·{" "}
                {job.largeBags} large, {job.smallBags} small{" "}
                {job.largeBags + job.smallBags === 1 ? "bag" : "bags"}
              </Field>
              {customer ? (
                <Field label="Customer">
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {customer.name}
                  </Link>
                  <span className="text-ink-3 block text-sm">
                    Every booking they have made
                  </span>
                </Field>
              ) : null}
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
                <ContactButtons phone={job.leadPhone} who="the passenger" />
              </Field>
              <Field label="Booker">
                {booking?.bookerName || job.bookerName ? (
                  <>
                    {booking?.bookerName || job.bookerName}
                    <span className="text-ink-3 block text-sm">
                      {[
                        booking?.bookerPhone || job.bookerPhone,
                        booking?.bookerEmail || job.bookerEmail,
                      ]
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
              {outbound || returnJob ? (
                <Field label={outbound ? "Outbound journey" : "Return trip"} wide>
                  <Link
                    href={`/admin/jobs/${(outbound ?? returnJob)!.id}`}
                    className="text-accent font-medium hover:underline"
                  >
                    {(outbound ?? returnJob)!.reference}
                  </Link>{" "}
                  <span className="text-ink-3 text-sm">
                    {pickupLabel(new Date((outbound ?? returnJob)!.pickupAt))}
                  </span>
                </Field>
              ) : null}
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
              {job.cancelReason ? (
                <Field label="Why it was cancelled" wide>
                  {job.cancelReason}
                </Field>
              ) : null}
            </Fields>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Progress"
            description={
              dispatches && !closed
                ? `Move the booking on as the ${operator ? "operator" : "driver"} reports in. One stage at a time.`
                : undefined
            }
            actions={<JobStatusBadge status={status} />}
          >
            <div className="flex flex-col gap-4">
              <StageProgress job={job} />
              {dispatches ? (
                <>
                  {/* A subcontracting operator runs the same stages as a driver. */}
                  {driver || operator ? (
                    <NextStageButtons job={job} now={now} className="print:hidden" />
                  ) : !closed ? (
                    <p className="text-ink-3 text-sm">
                      The cycle starts once a driver or operator is assigned.
                    </p>
                  ) : null}
                  {isDone(status) && !changesDone ? (
                    <p className="text-ink-3 text-sm">
                      Completed: only the Owner can change it now.
                    </p>
                  ) : (
                    <StepBackForm
                      key={status}
                      jobId={job.id}
                      options={previousStages(status).map((stage) => ({
                        value: stage,
                        label: stageName(stage),
                      }))}
                    />
                  )}
                  {changeable && (driver || !website || cancelsOrder) ? (
                    <div className="border-line flex flex-wrap gap-2 border-t pt-3 print:hidden">
                      {driver ? (
                        <ConfirmDialog
                          label="Remove driver"
                          icon={<UserMinus aria-hidden className="h-4 w-4" />}
                          variant="ghost"
                          size="sm"
                          title={`Take ${driver.fullName} off this booking?`}
                          confirmLabel="Remove driver"
                          confirmVariant="danger"
                          action={removeDriverAction}
                          fields={{ jobId: job.id }}
                        >
                          <p>
                            {job.reference} goes back to Unassigned and starts the cycle
                            again with the next driver. You will be offered a WhatsApp
                            message to tell {driver.firstName}.
                          </p>
                          <label
                            htmlFor="taken-off-reason"
                            className="text-ink-2 font-medium"
                          >
                            Why is {driver.firstName} coming off it?
                          </label>
                          <textarea
                            id="taken-off-reason"
                            name="reason"
                            rows={2}
                            maxLength={1000}
                            required
                            className={TEXTAREA_CLASS}
                          />
                          <p className="text-ink-3 text-xs">
                            Kept on the booking&apos;s history and shown in the Driver
                            Report.
                          </p>
                        </ConfirmDialog>
                      ) : null}
                      {!website ? (
                        <ConfirmDialog
                          label="Cancel booking"
                          icon={<Ban aria-hidden className="h-4 w-4" />}
                          variant="ghost"
                          size="sm"
                          title={`Cancel ${job.reference}?`}
                          confirmLabel="Cancel booking"
                          confirmVariant="danger"
                          pendingLabel="Cancelling…"
                          action={setStatusAction}
                          fields={{ jobId: job.id, status: "cancelled" }}
                        >
                          <p>
                            The booking for <strong>{job.leadName}</strong>,{" "}
                            {pickupLabel(at)}, from {job.pickupAddress}
                            {supplier
                              ? ` (${supplier.name} ${job.supplierReference})`
                              : ""}
                            .
                          </p>
                          {driver ? (
                            <p>
                              {driver.fullName} is assigned. You will be offered a
                              WhatsApp message to tell them.
                            </p>
                          ) : null}
                          <label
                            htmlFor="cancel-reason"
                            className="text-ink-2 font-medium"
                          >
                            Why is it cancelled?
                          </label>
                          <textarea
                            id="cancel-reason"
                            name="reason"
                            rows={2}
                            required
                            className={TEXTAREA_CLASS}
                          />
                        </ConfirmDialog>
                      ) : null}
                      {cancelsOrder ? (
                        <ConfirmDialog
                          label="Cancel booking"
                          icon={<Ban aria-hidden className="h-4 w-4" />}
                          variant="ghost"
                          size="sm"
                          title={`Cancel website booking ${booking!.reference}?`}
                          confirmLabel="Cancel booking"
                          confirmVariant="danger"
                          pendingLabel="Cancelling…"
                          action={cancelWebsiteBookingAction}
                          fields={{ jobId: job.id }}
                        >
                          <p>
                            The whole booking is cancelled, with every journey still to
                            come:
                          </p>
                          <ul className="flex flex-col gap-1">
                            {orderLegs.map((leg) => (
                              <li key={leg.id} className="text-sm">
                                <span className="font-medium tabular-nums">
                                  {leg.reference}
                                </span>{" "}
                                · {pickupLabel(new Date(leg.pickupAt))} · from{" "}
                                {leg.pickupAddress}
                                {isFinal(leg.status) ? (
                                  <span className="text-ink-3">
                                    {" "}
                                    · {stageName(leg.status)}, stays as it is
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <p className="text-ink-3 text-sm">
                            No money moves here. Make any refund in Stripe, then record it
                            on the payment. The customer is not emailed.
                            {orderLegs.some((leg) => !isFinal(leg.status) && leg.driver)
                              ? " You will be offered a WhatsApp message for each driver."
                              : ""}
                          </p>
                          <label
                            htmlFor="cancel-order-reason"
                            className="text-ink-2 font-medium"
                          >
                            Why is it cancelled?
                          </label>
                          <textarea
                            id="cancel-order-reason"
                            name="reason"
                            rows={2}
                            required
                            className={TEXTAREA_CLASS}
                          />
                        </ConfirmDialog>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </Panel>

          <Panel
            title="Driver and dispatch"
            description="The TfL booking record (CMP-03)"
            actions={
              dispatches && changeable && (driver || job.operator) ? (
                <ButtonLink href={`/admin/jobs/${job.id}/assign`} size="sm">
                  Change
                </ButtonLink>
              ) : null
            }
          >
            <Fields className="sm:grid-cols-1">
              {job.operator ? (
                <>
                  <Field label="Subcontracted to">
                    {operator ? (
                      <Link
                        href={`/admin/operators/${operator.id}`}
                        className="text-ink font-medium hover:underline"
                      >
                        {operator.name}
                      </Link>
                    ) : (
                      <span className="text-ink font-medium">
                        {job.subcontractorName}
                      </span>
                    )}
                    <span className="text-ink-3 block text-sm">
                      Their own driver and car
                    </span>
                    {operator ? (
                      <>
                        <span className="text-ink-3 block text-sm tabular-nums">
                          {operator.phone}
                        </span>
                        <ContactButtons
                          phone={operator.phone}
                          who={operator.contactName || operator.name}
                        />
                      </>
                    ) : null}
                  </Field>
                  <Field label="Licensed by">
                    {job.subcontractorLicensedFrom || (
                      <NotRecorded>Not recorded</NotRecorded>
                    )}
                  </Field>
                  <Field label="Operator licence">
                    {job.subcontractorLicenceNo || (
                      <NotRecorded>Not recorded</NotRecorded>
                    )}
                  </Field>
                </>
              ) : null}
              {job.operator ? null : (
                <Field label="Driver">
                  {driver ? (
                    <>
                      <Link
                        href={`/admin/drivers/${driver.id}`}
                        className="text-ink font-medium hover:underline"
                      >
                        {driver.fullName}
                      </Link>
                      <span className="text-ink-3 block text-sm tabular-nums">
                        {driver.phone}
                      </span>
                      <ContactButtons phone={driver.phone} who={driver.firstName} />
                    </>
                  ) : (
                    <NotRecorded>Not assigned</NotRecorded>
                  )}
                </Field>
              )}
              {job.operator ? null : (
                <Field label="PHV licence">
                  {job.driverPhvNo || <NotRecorded>Not assigned</NotRecorded>}
                </Field>
              )}
              {job.operator ? null : (
                <Field label="Vehicle">
                  {vehicle ? (
                    <>
                      <span className="font-medium tabular-nums">
                        {vehicle.registration}
                      </span>{" "}
                      <span className="text-ink-3 text-sm">
                        {vehicle.colour} {vehicle.make} {vehicle.model}
                      </span>
                    </>
                  ) : (
                    job.vehicleReg || <NotRecorded>Not assigned</NotRecorded>
                  )}
                </Field>
              )}
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

            <div className="border-line mt-4 border-t pt-4">
              {dispatches ? (
                <DriverPriceForm
                  key={job.driverPricePence ?? "none"}
                  jobId={job.id}
                  pricePence={job.driverPricePence ?? null}
                  customerPricePence={job.customerPricePence ?? null}
                  operator={Boolean(job.operator)}
                />
              ) : (
                <Fields className="sm:grid-cols-1">
                  <Field label="Driver price">
                    {job.driverPricePence === null ||
                    job.driverPricePence === undefined ? (
                      <NotRecorded>Not written yet</NotRecorded>
                    ) : (
                      <span className="tabular-nums">{money(job.driverPricePence)}</span>
                    )}
                  </Field>
                </Fields>
              )}
            </div>
          </Panel>

          {recipient && dispatches && (!closed || status === "cancelled") ? (
            <Panel
              title={
                recipient.operator
                  ? "Operator's WhatsApp message"
                  : "Driver's WhatsApp message"
              }
              actions={<Badge tone={messageStatus.tone}>{messageStatus.label}</Badge>}
            >
              <div className="flex flex-col gap-3">
                {job.driverMessageAt ? (
                  <p className="text-ink-3 text-sm">
                    Last opened in WhatsApp {stamp(new Date(job.driverMessageAt))}.
                  </p>
                ) : null}
                {job.status === "cancelled" ? (
                  <DriverMessage
                    job={job}
                    to={recipient}
                    kind="cancelled"
                    label={
                      recipient.operator
                        ? "Tell the operator it is cancelled"
                        : "Tell the driver it is cancelled"
                    }
                  />
                ) : !closed ? (
                  <DriverMessage
                    job={job}
                    to={recipient}
                    kind={job.driverMessageStatus === "not_sent" ? "new" : "update"}
                    label={
                      job.driverMessageStatus === "not_sent"
                        ? "Send job on WhatsApp"
                        : "Send again on WhatsApp"
                    }
                    variant={
                      job.driverMessageStatus === "not_sent" ? "primary" : "secondary"
                    }
                  />
                ) : null}
                {job.driverMessageStatus !== "not_sent" && !closed ? (
                  <div className="flex flex-col gap-1.5">
                    <p id="whatsapp-shows" className="text-ink-3 text-xs">
                      Record what WhatsApp shows
                    </p>
                    <div
                      role="group"
                      aria-labelledby="whatsapp-shows"
                      className="border-line grid grid-cols-3 gap-1 rounded-md border p-1"
                    >
                      {(["delivered", "read", "failed"] as const).map((status) => (
                        <form key={status} action={setDriverMessageStatusAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            type="submit"
                            aria-pressed={job.driverMessageStatus === status}
                            className={buttonClass(
                              job.driverMessageStatus === status ? "secondary" : "ghost",
                              "sm",
                              "w-full px-2",
                            )}
                          >
                            {MESSAGE_STATUS[status]!.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {driver && dispatches && !closed && driverDetailsEmailsOn() ? (
            <Panel
              title="Driver details to the passenger"
              actions={<Badge tone={passengerStatus.tone}>{passengerStatus.label}</Badge>}
            >
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-ink-3">
                  {driver.firstName}, PHV licence {job.driverPhvNo ?? "—"},{" "}
                  {vehicle
                    ? `${vehicle.colour} ${vehicle.make} ${vehicle.model}`
                    : "vehicle"}{" "}
                  {job.vehicleReg}
                  {job.passengerMessageAt
                    ? ` · last attempt ${stamp(new Date(job.passengerMessageAt))}`
                    : ""}
                </p>
                {job.leadEmail || job.bookerEmail || booking?.bookerEmail ? (
                  <form action={sendDriverDetailsAction}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <button type="submit" className={buttonClass("secondary", "md")}>
                      <Mail aria-hidden className="h-4 w-4" />
                      {job.passengerMessageStatus === "sent"
                        ? "Email them again"
                        : "Email the passenger"}
                    </button>
                  </form>
                ) : (
                  <p className="text-ink-3">
                    There is no email address for the passenger.
                  </p>
                )}
              </div>
            </Panel>
          ) : null}

          {seesFinance ? (
            <Panel title="Finance">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Customer price</dt>
                  <dd className="font-medium tabular-nums">
                    {money(job.customerPricePence)}
                  </dd>
                </div>
                {customerPaid ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-3">Customer</dt>
                    <dd className="text-right">
                      {customerPaid.href ? (
                        <Link
                          href={customerPaid.href}
                          className={
                            customerPaid.waiting
                              ? "text-warn hover:underline"
                              : "text-accent hover:underline"
                          }
                        >
                          {customerPaid.text}
                        </Link>
                      ) : (
                        <span className="text-ink-3">{customerPaid.text}</span>
                      )}
                    </dd>
                  </div>
                ) : null}
                {customerPaid?.refundedPence ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-3">Refunded</dt>
                    <dd className="tabular-nums">
                      − {money(customerPaid.refundedPence)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Card fees</dt>
                  <dd className="tabular-nums">
                    {feesKnown ? `− ${money(job.paymentFeePence)}` : <NotRecorded />}
                  </dd>
                </div>
                <div className="border-line flex justify-between gap-3 border-t pt-2">
                  <dt className="text-ink font-medium">Net revenue</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(takings.netPence)}
                    {!feesKnown && job.paymentMethod === "web_prepaid" ? (
                      <span className="text-ink-3 block text-right text-xs font-normal">
                        before card fees
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Driver price</dt>
                  <dd className="tabular-nums">
                    {takings.driverPricePence === null ? (
                      <NotRecorded>Not written yet</NotRecorded>
                    ) : (
                      `− ${money(takings.driverPricePence)}`
                    )}
                  </dd>
                </div>
                {takings.penaltyPence ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-3">Partner penalties Cityline bears</dt>
                    <dd className="tabular-nums">− {money(takings.penaltyPence)}</dd>
                  </div>
                ) : null}
                <div className="border-line flex justify-between gap-3 border-t pt-2">
                  <dt className="text-ink font-medium">
                    {takings.profitPence !== null && takings.profitPence < 0
                      ? "Loss"
                      : "Profit"}
                  </dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {takings.profitPence === null ? (
                      <NotRecorded>Needs the driver price</NotRecorded>
                    ) : (
                      <span
                        className={takings.profitPence < 0 ? "text-danger" : undefined}
                      >
                        {money(takings.profitPence)}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
              {partnerBooking && (penalties.length || recordsPenalties) ? (
                <div className="border-line -mx-5 mt-4 border-t">
                  <p className="text-ink px-5 pt-4 text-sm font-semibold">
                    Partner penalties
                  </p>
                  {penalties.length ? (
                    <PenaltyList
                      penalties={penalties}
                      canVoid={can(user.role, "supplierMoney.manage")}
                      back={{ from: "job", jobId: job.id }}
                    />
                  ) : (
                    <p className="text-ink-3 px-5 pt-1 text-sm">None recorded.</p>
                  )}
                  {recordsPenalties ? (
                    <details className="px-5 pt-3">
                      <summary className="text-accent cursor-pointer text-sm font-medium">
                        Record a partner penalty
                      </summary>
                      <div className="pt-4">
                        <PenaltyForm
                          jobId={job.id}
                          today={londonDay(now)}
                          takenFrom={
                            driver
                              ? (driver.fullName ?? "the driver")
                              : operator
                                ? operator.name
                                : null
                          }
                        />
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}
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
