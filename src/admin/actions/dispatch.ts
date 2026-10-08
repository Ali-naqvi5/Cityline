"use server";

import { redirect } from "next/navigation";
import type { Payload } from "payload";

import { payloadErrors, text, zodErrors } from "@/admin/form-errors";
import type { FormState, JobFormState } from "@/admin/form-state";
import { pickupLabel } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import {
  capacityProblem,
  jobData,
  jobForm,
  jobSchema,
  websiteJobData,
  websiteJobSchema,
} from "@/admin/schemas/job";
import { findOrCreateCustomer } from "@/domain/customers/link";
import { relId } from "@/domain/dispatch/assignment";
import { possibleDuplicates } from "@/domain/jobs/duplicates";
import { isJobStatus } from "@/domain/jobs/labels";
import { nextJobReference } from "@/domain/jobs/next-reference";
import { parsePounds } from "@/domain/money";
import type { DriverMessageKind } from "@/domain/messaging/driver-message";
import { driverDetailsEmail } from "@/domain/notifications/booking-emails";
import { sendEmail } from "@/lib/email";
import { driverDetailsEmailsOn } from "@/lib/features";
import type { Booking, Driver, Job, User, Vehicle } from "@/payload-types";

/**
 * Creating, editing and dispatching jobs (spec §13, §14, §19, §27, §28).
 *
 * Each action checks the member of staff on the server and writes as them,
 * so the jobs collection's rules — no website jobs by hand, locked website
 * fields, driver eligibility, the status order — apply whatever the page
 * showed, and the audit log and job history name them.
 */

type Staff = User & { role: string };

async function jobFor(payload: Payload, user: Staff, id: number): Promise<Job | null> {
  if (!Number.isInteger(id)) return null;
  return (await payload.findByID({
    collection: "jobs",
    id,
    depth: 0,
    user,
    overrideAccess: false,
    disableErrors: true,
  })) as Job | null;
}

async function recordEvent(
  payload: Payload,
  user: Staff,
  jobId: number,
  event: {
    type: "message_sent" | "updated";
    field: string;
    newValue: string;
    oldValue?: string;
  },
) {
  await payload.create({
    collection: "job-events",
    data: { job: jobId, ...event, actorType: "user", actorUser: user.id },
    user,
    overrideAccess: false,
  });
}

// --- Create and edit ------------------------------------------------------------

export async function saveJobAction(
  _previous: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const { payload, user } = await staffForAction("jobs.edit");
  const id = Number(text(formData, "id")) || null;
  const existing = id ? await jobFor(payload, user, id) : null;
  if (id && !existing) return { errors: {}, message: "That job no longer exists." };

  // A website job: only its operational details (JOB-07).
  if (existing?.source === "website") {
    const parsed = websiteJobSchema.safeParse({
      pickupDate: text(formData, "pickupDate"),
      pickupTime: text(formData, "pickupTime"),
      flightNumber: text(formData, "flightNumber"),
      passengers: text(formData, "passengers"),
      largeBags: text(formData, "largeBags") || "0",
      smallBags: text(formData, "smallBags") || "0",
      nameBoardText: text(formData, "nameBoardText"),
      meetAndGreet: formData.get("meetAndGreet") === "on",
      driverNotes: text(formData, "driverNotes"),
      internalNotes: text(formData, "internalNotes"),
      notifyPassenger: formData.get("notifyPassenger") === "on",
    });
    if (!parsed.success) return zodErrors(parsed.error);
    const capacity = capacityProblem(
      existing.vehicleClassSlug,
      Number(parsed.data.passengers),
    );
    if (capacity) {
      return {
        errors: { passengers: capacity },
        message: "Please check the highlighted fields.",
      };
    }
    try {
      await payload.update({
        collection: "jobs",
        id: existing.id,
        data: websiteJobData(parsed.data, existing.leadName),
        user,
        overrideAccess: false,
      });
    } catch (error) {
      return payloadErrors(error, "saving a website job");
    }
    redirect(`/admin/jobs/${existing.id}?notice=saved`);
  }

  const parsed = jobSchema.safeParse(jobForm(formData));
  if (!parsed.success) return zodErrors(parsed.error);
  const data = jobData(parsed.data);

  // Possible duplicates (spec §14): shown before a new job is saved, and saved
  // only once the controller has seen them and said to go ahead.
  const returnOf = Number(text(formData, "returnOf")) || null;
  if (!existing && text(formData, "confirmDuplicate") !== "1") {
    const pickupAt = new Date(data.pickupAt);
    const nearby = await payload.find({
      collection: "jobs",
      where: {
        and: [
          { status: { not_equals: "cancelled" } },
          {
            pickupAt: {
              greater_than: new Date(pickupAt.getTime() - 86_400_000).toISOString(),
            },
          },
          {
            pickupAt: {
              less_than: new Date(pickupAt.getTime() + 86_400_000).toISOString(),
            },
          },
          ...(returnOf ? [{ id: { not_equals: returnOf } }] : []),
        ],
      },
      pagination: false,
      depth: 0,
      user,
      overrideAccess: false,
    });
    const matches = possibleDuplicates(
      {
        leadName: data.leadName,
        leadPhone: data.leadPhone,
        pickupAt,
        flightNumber: data.flightNumber,
      },
      nearby.docs,
    );
    if (matches.length) {
      return {
        errors: {},
        message: "This may already be entered. Check the jobs below before saving.",
        duplicates: matches.map(({ job, reasons }) => ({
          id: job.id,
          reference: job.reference,
          when: pickupLabel(new Date(job.pickupAt)),
          passenger: job.leadName,
          reasons,
        })),
      };
    }
  }

  let savedId: number;
  try {
    // One history per person: an office booking belongs to the customer with
    // this email, or this phone and name — or to a new one. A supplier's
    // passengers are the supplier's customers, so are not recorded.
    const customer =
      data.source !== "supplier" && !(existing && existing.customer)
        ? await findOrCreateCustomer(
            payload,
            { name: data.leadName, phone: data.leadPhone, email: data.leadEmail },
            { user, overrideAccess: false },
            data.isTest,
          )
        : null;
    const linked = customer ? { customer: customer.id } : {};

    if (existing) {
      const saved = await payload.update({
        collection: "jobs",
        id: existing.id,
        data: { ...data, ...linked },
        user,
        overrideAccess: false,
      });
      savedId = saved.id;
    } else {
      const saved = await payload.create({
        collection: "jobs",
        data: {
          ...data,
          ...linked,
          reference: await nextJobReference(payload),
          status: "unassigned",
          driverMessageStatus: "not_sent",
          passengerMessageStatus: "not_sent",
          ...(returnOf ? { returnOfJob: returnOf, leg: "return" as const } : {}),
        },
        user,
        overrideAccess: false,
      });
      savedId = saved.id;
    }
  } catch (error) {
    return payloadErrors(error, "saving a job");
  }

  redirect(`/admin/jobs/${savedId}?notice=${existing ? "saved" : "created"}`);
}

// --- Assign and remove ---------------------------------------------------------------

const TAKEN_OFF_MESSAGE = "Write why the driver is coming off this booking.";

/**
 * The reason typed for taking a driver off, required whenever one is (the
 * jobs hook insists too). Shown under the box as `reason`.
 */
function takenOffReasonFrom(formData: FormData): string | null {
  const reason = text(formData, "reason").trim().slice(0, 1000);
  return reason || null;
}

/** The hook's refusal, if any, under the reason box where it belongs. */
function withReasonError(state: FormState): FormState {
  const message = state.errors.takenOffReason;
  if (!message) return state;
  const errors: Record<string, string> = { ...state.errors, reason: message };
  delete errors.takenOffReason;
  return { ...state, errors };
}

export async function assignDriverAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, Number(text(formData, "jobId")));
  if (!job) return { errors: {}, message: "That job no longer exists." };

  const [driverId, vehicleId] = text(formData, "pair").split(":").map(Number);
  if (!driverId || !vehicleId) {
    return {
      errors: { pair: "Choose a driver." },
      message: "Choose a driver and vehicle.",
    };
  }

  const price = driverPriceFrom(formData);
  if (price === "invalid") {
    return {
      errors: { driverPrice: DRIVER_PRICE_MESSAGE },
      message: "Check the driver's price.",
    };
  }

  const previousDriver = relId(job.driver);
  const replacing = previousDriver !== null && previousDriver !== driverId;
  const reason = takenOffReasonFrom(formData);
  if (replacing && !reason) {
    return { errors: { reason: TAKEN_OFF_MESSAGE }, message: TAKEN_OFF_MESSAGE };
  }

  let saved: Job;
  try {
    saved = (await payload.update({
      collection: "jobs",
      id: job.id,
      data: {
        driver: driverId,
        vehicle: vehicleId,
        ...(replacing ? { takenOffReason: reason } : {}),
        notifyPassenger: formData.get("notifyPassenger") === "on",
        // Left as it was when the box is empty: a change of driver keeps the
        // agreed price unless a new one is written.
        ...(price === null ? {} : { driverPricePence: price }),
      },
      user,
      overrideAccess: false,
    })) as Job;
  } catch (error) {
    return withReasonError(payloadErrors(error, "assigning a driver"));
  }

  let emailed = "";
  if (saved.notifyPassenger && driverDetailsEmailsOn()) {
    emailed = (await emailDriverDetails(payload, user, saved.id, "assigned")) ? "1" : "0";
  }

  const query = new URLSearchParams({ notice: "assigned" });
  if (emailed) query.set("emailed", emailed);
  if (previousDriver && previousDriver !== driverId)
    query.set("previous", String(previousDriver));
  redirect(`/admin/jobs/${job.id}?${query}`);
}

export async function removeDriverAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, Number(text(formData, "jobId")));
  if (!job) return { errors: {}, message: "That job no longer exists." };
  const previousDriver = relId(job.driver);
  const reason = takenOffReasonFrom(formData);
  if (!reason) return { errors: { reason: TAKEN_OFF_MESSAGE }, message: "" };

  try {
    await payload.update({
      collection: "jobs",
      id: job.id,
      data: { driver: null, vehicle: null, takenOffReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return withReasonError(payloadErrors(error, "removing a driver"));
  }
  redirect(
    `/admin/jobs/${job.id}?notice=driver-removed${previousDriver ? `&previous=${previousDriver}` : ""}`,
  );
}

// --- Driver price ---------------------------------------------------------------

const DRIVER_PRICE_MESSAGE = "Enter the driver's price in pounds, such as 35 or 35.50.";

/** The driver's price from a form: pence, null when empty, or "invalid". */
function driverPriceFrom(formData: FormData): number | null | "invalid" {
  const value = text(formData, "driverPrice");
  if (!value) return null;
  const pence = parsePounds(value);
  return pence === null || pence < 0 ? "invalid" : pence;
}

/**
 * What the driver is paid for this booking — agreed per booking and written
 * on it, by whoever dispatches. Clearing the box clears the price.
 */
export async function setDriverPriceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, Number(text(formData, "jobId")));
  if (!job) return { errors: {}, message: "That booking no longer exists." };

  const price = driverPriceFrom(formData);
  if (price === "invalid") {
    return { errors: { driverPrice: DRIVER_PRICE_MESSAGE }, message: "" };
  }
  try {
    await payload.update({
      collection: "jobs",
      id: job.id,
      data: { driverPricePence: price },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "saving a driver's price");
  }
  redirect(`/admin/jobs/${job.id}?notice=driver-price`);
}

// --- Status ---------------------------------------------------------------------

/** Only admin pages, so a form cannot be used to send staff off the site. */
function safeReturn(value: string): string | null {
  return /^\/admin\/[\w\-/?=&%.+,]*$/.test(value) ? value : null;
}

/**
 * Moves a booking to another stage of its cycle (spec §10, Cityline's cycle
 * of 2 Oct 2026): one stage forward, or back any number. The jobs hook holds
 * the rules, so this is refused exactly as an API call would be.
 *
 * The no-show dialog can carry a new driver price in the same step — a driver
 * who waited for a passenger who never came is often paid less. A form on
 * the dispatch board or the bookings dashboard says where to return to, so
 * an operator moving jobs on stays where they are.
 */
export async function setStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, Number(text(formData, "jobId")));
  if (!job) return { errors: {}, message: "That booking no longer exists." };

  const status = text(formData, "status");
  if (!isJobStatus(status) || status === "unassigned") {
    return { errors: {}, message: "That is not a stage you can set here." };
  }
  const reason = text(formData, "reason");
  if (status === "cancelled") {
    if (job.source === "website") {
      return {
        errors: {},
        message:
          "Website bookings are cancelled from the booking, so the customer's payment is settled with it.",
      };
    }
    if (!reason) {
      return { errors: { reason: "Say why the booking is cancelled." }, message: "" };
    }
  }
  const price = driverPriceFrom(formData);
  if (price === "invalid") {
    return { errors: { driverPrice: DRIVER_PRICE_MESSAGE }, message: "" };
  }

  try {
    await payload.update({
      collection: "jobs",
      id: job.id,
      data: {
        status,
        ...(status === "cancelled" ? { cancelReason: reason } : {}),
        ...(price === null ? {} : { driverPricePence: price }),
      },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "changing a booking's stage");
  }

  const back = safeReturn(text(formData, "returnTo"));
  if (back) redirect(back);
  redirect(`/admin/jobs/${job.id}?notice=status-${status}`);
}

// --- WhatsApp ----------------------------------------------------------------------

const KIND_LABELS: Record<DriverMessageKind, string> = {
  new: "Job message",
  update: "Updated job message",
  removed: "Job removed message",
  cancelled: "Job cancelled message",
};

/**
 * Called as "Send on WhatsApp" opens WhatsApp. What is recorded is exactly
 * what the system knows: the message was opened in WhatsApp for this driver.
 * Whether it arrived is shown in WhatsApp, and the controller can mark it.
 */
export async function recordWhatsAppAction(
  jobId: number,
  driverId: number,
  kind: DriverMessageKind,
): Promise<void> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, jobId);
  if (!job) return;
  const driver = (await payload.findByID({
    collection: "drivers",
    id: driverId,
    depth: 0,
    user,
    overrideAccess: false,
    disableErrors: true,
  })) as Driver | null;
  if (!driver) return;

  if ((kind === "new" || kind === "update") && relId(job.driver) === driver.id) {
    await payload.update({
      collection: "jobs",
      id: job.id,
      data: { driverMessageStatus: "sent", driverMessageAt: new Date().toISOString() },
      user,
      overrideAccess: false,
    });
  }
  await recordEvent(payload, user, job.id, {
    type: "message_sent",
    field: "whatsapp",
    newValue: `${KIND_LABELS[kind]} opened in WhatsApp for ${driver.fullName ?? "the driver"}`,
  });
}

const MESSAGE_STATUS_LABELS = {
  delivered: "delivered",
  read: "read",
  failed: "not delivered",
};

export async function setDriverMessageStatusAction(formData: FormData): Promise<void> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, Number(text(formData, "jobId")));
  const status = text(formData, "status");
  if (!job || !(status in MESSAGE_STATUS_LABELS) || !job.driver) {
    redirect(`/admin/jobs/${job?.id ?? ""}`);
  }
  await payload.update({
    collection: "jobs",
    id: job.id,
    data: { driverMessageStatus: status as keyof typeof MESSAGE_STATUS_LABELS },
    user,
    overrideAccess: false,
  });
  await recordEvent(payload, user, job.id, {
    type: "message_sent",
    field: "whatsapp",
    newValue: `WhatsApp job message marked ${MESSAGE_STATUS_LABELS[status as keyof typeof MESSAGE_STATUS_LABELS]}`,
  });
  redirect(`/admin/jobs/${job.id}`);
}

// --- Driver details to the passenger (NOT-02) ------------------------------------

/**
 * Emails the passenger who is coming. Returns whether it went. The attempt
 * is recorded on the job either way — a failed send is history too.
 */
async function emailDriverDetails(
  payload: Payload,
  user: Staff,
  jobId: number,
  reason: "assigned" | "resend",
): Promise<boolean> {
  // Switched off (Cityline, 9 Oct 2026): nothing is sent or recorded.
  if (!driverDetailsEmailsOn()) return false;
  const job = (await payload.findByID({
    collection: "jobs",
    id: jobId,
    depth: 1,
    user,
    overrideAccess: false,
  })) as Job;
  const driver = typeof job.driver === "object" ? (job.driver as Driver | null) : null;
  const vehicle =
    typeof job.vehicle === "object" ? (job.vehicle as Vehicle | null) : null;
  const booking =
    typeof job.booking === "object" ? (job.booking as Booking | null) : null;
  const to = job.leadEmail || job.bookerEmail || booking?.bookerEmail || null;

  let outcome: { sent: true } | { sent: false; reason: string };
  if (!driver || !vehicle) {
    outcome = { sent: false, reason: "no driver assigned" };
  } else if (!to) {
    outcome = { sent: false, reason: "no email address for the passenger" };
  } else if (!job.driverPhvNo) {
    outcome = { sent: false, reason: "the driver has no PHV licence number on record" };
  } else {
    const email = driverDetailsEmail({
      reference: booking?.reference ?? job.reference,
      pickupAt: new Date(job.pickupAt),
      pickup: job.pickupAddress,
      driverFirstName: driver.firstName,
      phvLicence: job.driverPhvNo,
      vehicle: `${vehicle.make} ${vehicle.model}`,
      colour: vehicle.colour,
      registration: vehicle.registration,
    });
    outcome = await sendEmail({
      to,
      ...email,
      audience: "customer",
      // One email per assignment; a resend is a new message, once a minute at most.
      idempotencyKey:
        reason === "assigned"
          ? `driver-details:${job.reference}:${job.dispatchedAt}`
          : `driver-details:${job.reference}:resend:${Math.floor(Date.now() / 60_000)}`,
    });
  }

  await payload.update({
    collection: "jobs",
    id: job.id,
    data: {
      passengerMessageStatus: outcome.sent ? "sent" : "failed",
      passengerMessageAt: new Date().toISOString(),
    },
    user,
    overrideAccess: false,
  });
  await recordEvent(payload, user, job.id, {
    type: "message_sent",
    field: "passengerEmail",
    newValue: outcome.sent
      ? `Driver details emailed to the passenger (${to})`
      : `Driver details NOT sent to the passenger: ${outcome.reason}`,
  });
  return outcome.sent;
}

export async function sendDriverDetailsAction(formData: FormData): Promise<void> {
  const { payload, user } = await staffForAction("jobs.dispatch");
  const job = await jobFor(payload, user, Number(text(formData, "jobId")));
  if (!job) redirect("/admin/bookings");
  if (!driverDetailsEmailsOn()) redirect(`/admin/jobs/${job.id}?notice=details-off`);
  const sent = await emailDriverDetails(payload, user, job.id, "resend");
  redirect(`/admin/jobs/${job.id}?notice=${sent ? "details-sent" : "details-failed"}`);
}
