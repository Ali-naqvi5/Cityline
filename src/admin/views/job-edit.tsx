import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { money } from "@/admin/format";
import { JobForm, type JobFormValues, type SupplierChoice } from "@/admin/forms/job-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { driverDetailsEmailsOn } from "@/lib/features";
import {
  ButtonLink,
  Field,
  Fields,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { relId } from "@/domain/dispatch/assignment";
import { isDone } from "@/domain/jobs/status";
import { can } from "@/domain/staff/permissions";
import { londonDateAndTime } from "@/lib/time";
import type { Job, Supplier } from "@/payload-types";

/**
 * Creating a job (`/jobs/new`, spec §13), its return trip
 * (`/jobs/new?returnOf=12`), and editing one (`/jobs/:id/edit`). A website
 * booking's job edits only its operational details (JOB-07).
 */

const EMPTY: JobFormValues = {
  source: "",
  supplier: "",
  supplierReference: "",
  pickupDate: "",
  pickupTime: "",
  pickupAddress: "",
  stops: [],
  bookingType: "transfer",
  dropoffAddress: "",
  hours: "",
  flightNumber: "",
  vehicleClassSlug: "saloon",
  passengers: "1",
  largeBags: "0",
  smallBags: "0",
  leadName: "",
  leadPhone: "",
  leadEmail: "",
  nameBoardText: "",
  meetAndGreet: true,
  bookerName: "",
  bookerPhone: "",
  bookerEmail: "",
  extras: {},
  price: "",
  paymentMethod: "",
  driverNotes: "",
  internalNotes: "",
  notifyPassenger: true,
  isTest: false,
};

function valuesFrom(job: Job): JobFormValues {
  const { date, time } = londonDateAndTime(new Date(job.pickupAt));
  return {
    id: job.id,
    source: job.source,
    supplier: String(relId(job.supplier) ?? ""),
    supplierReference: job.supplierReference ?? "",
    pickupDate: date,
    pickupTime: time,
    pickupAddress: job.pickupAddress,
    stops: (job.viaStops ?? []).map((stop) => stop.address),
    bookingType: job.hours && !job.dropoffAddress ? "hourly" : "transfer",
    dropoffAddress: job.dropoffAddress ?? "",
    hours: job.hours ? String(job.hours) : "",
    flightNumber: job.flightNumber ?? "",
    vehicleClassSlug: job.vehicleClassSlug,
    passengers: String(job.passengers),
    largeBags: String(job.largeBags),
    smallBags: String(job.smallBags),
    leadName: job.leadName,
    leadPhone: job.leadPhone,
    leadEmail: job.leadEmail ?? "",
    nameBoardText:
      job.nameBoardText && job.nameBoardText !== job.leadName ? job.nameBoardText : "",
    meetAndGreet: job.meetAndGreet ?? false,
    bookerName: job.bookerName ?? "",
    bookerPhone: job.bookerPhone ?? "",
    bookerEmail: job.bookerEmail ?? "",
    extras: Object.fromEntries(
      (job.extras ?? []).map((extra) => [extra.slug, extra.quantity]),
    ),
    price: (job.customerPricePence / 100).toFixed(2),
    paymentMethod: job.paymentMethod,
    driverNotes: job.driverNotes ?? "",
    internalNotes: job.internalNotes ?? "",
    notifyPassenger: job.notifyPassenger ?? true,
    isTest: job.isTest ?? false,
  };
}

/** The return of an outbound job: same people, the route reversed, no time yet. */
function returnValuesFrom(job: Job): JobFormValues {
  const outbound = valuesFrom(job);
  return {
    ...outbound,
    id: undefined,
    returnOf: job.id,
    pickupDate: "",
    pickupTime: "",
    pickupAddress: job.dropoffAddress ?? "",
    bookingType: "transfer",
    dropoffAddress: job.pickupAddress,
    stops: [...outbound.stops].reverse(),
    hours: "",
    flightNumber: "",
    price: "",
    driverNotes: "",
    internalNotes: "",
  };
}

export async function JobEditView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const isNew = idSegment === "new";
  const returnOf = Number(param(props.searchParams, "returnOf")) || null;
  const context = requireStaff(
    props,
    "jobs.edit",
    isNew ? "/admin/jobs/new" : `/admin/jobs/${idSegment}/edit`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  const sourceJobId = isNew ? returnOf : Number(idSegment);
  const job = sourceJobId
    ? ((await payload.findByID({
        collection: "jobs",
        id: sourceJobId,
        depth: 0,
        user,
        overrideAccess: false,
        disableErrors: true,
      })) as Job | null)
    : null;

  if (sourceJobId && !job) {
    return (
      <OpsShell user={user} active="bookings">
        <Panel>
          <EmptyState
            title="No booking with that number"
            action={<ButtonLink href="/admin/bookings">Back to bookings</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  // A completed or PNS booking is the Owner's to change (Cityline, 13 Oct 2026);
  // the jobs collection refuses anyone else's change too.
  if (!isNew && job && isDone(job.status) && !can(user.role, "jobs.editClosed")) {
    return (
      <OpsShell user={user} active="bookings">
        <Panel>
          <EmptyState
            title={`${job.reference} is completed`}
            description="Only the Owner can change a booking once it is completed or PNS."
            action={
              <ButtonLink href={`/admin/jobs/${job.id}`}>Back to the booking</ButtonLink>
            }
          />
        </Panel>
      </OpsShell>
    );
  }

  const suppliers = await payload.find({
    collection: "suppliers",
    where: { active: { equals: true } },
    sort: "name",
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  });
  const supplierChoices: SupplierChoice[] = suppliers.docs.map((supplier: Supplier) => ({
    id: supplier.id,
    name: supplier.name,
  }));

  const website = !isNew && job?.source === "website";
  // "New booking" from a customer's page starts with who they are.
  const customerId =
    isNew && !job ? Number(param(props.searchParams, "customer")) || null : null;
  const customer = customerId
    ? await payload.findByID({
        collection: "customers",
        id: customerId,
        depth: 0,
        user,
        overrideAccess: false,
        disableErrors: true,
      })
    : null;
  const values = !job
    ? customer
      ? {
          ...EMPTY,
          source: "phone",
          leadName: customer.name,
          leadPhone: customer.phone,
          leadEmail: customer.email ?? "",
        }
      : EMPTY
    : isNew
      ? returnValuesFrom(job)
      : valuesFrom(job);
  const mode = isNew ? "new" : website ? "website" : "edit";
  const back = isNew
    ? job
      ? `/admin/jobs/${job.id}`
      : "/admin/bookings"
    : `/admin/jobs/${job!.id}`;
  const title = isNew
    ? job
      ? `Return trip for ${job.reference}`
      : "New booking"
    : `Edit ${job!.reference}`;

  return (
    <OpsShell user={user} active="bookings">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {job ? job.reference : "Jobs"}
        </Link>
      </div>
      <PageHeader
        title={title}
        description={
          isNew && job
            ? "The passenger, booker and supplier are copied and the route reversed. Enter the return time, flight and price."
            : isNew
              ? "A job taken by phone, WhatsApp, email or from a supplier. Website bookings arrive on their own."
              : undefined
        }
      />
      <JobForm
        passengerEmails={driverDetailsEmailsOn()}
        values={values}
        suppliers={supplierChoices}
        cancelHref={back}
        mode={mode}
        locked={
          website && job ? (
            <Panel
              icon={<Lock />}
              title="Website booking"
              description="Price, customer and route are locked. Change them through Amend booking."
            >
              <Fields>
                <Field label="Passenger">
                  {job.leadName} · {job.leadPhone}
                </Field>
                <Field label="Price">{money(job.customerPricePence)}</Field>
                <Field label="Pickup" wide>
                  {job.pickupAddress}
                </Field>
                <Field label="Drop-off" wide>
                  {job.dropoffAddress || "Hourly hire"}
                </Field>
              </Fields>
            </Panel>
          ) : null
        }
      />
    </OpsShell>
  );
}
