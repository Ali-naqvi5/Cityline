import "server-only";

import {
  buildCalendar,
  calendarEventsForJobs,
  calendarFilename,
} from "@/domain/booking/calendar";
import { manageTokenFor } from "@/domain/booking/manage-token";
import { EXTRAS } from "@/domain/pricing/extras";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { company, siteUrl } from "@/lib/company";
import { sendEmail, type OutgoingEmail, type SendResult } from "@/lib/email";
import { payloadClient } from "@/lib/payload";
import type { Customer } from "@/payload-types";

import {
  bookingCancelledEmail,
  bookingChangedEmail,
  confirmationEmail,
  manageLinkEmail,
  officeBookingCancelledEmail,
  officeBookingChangedEmail,
  officeNewBookingEmail,
  type BookingChange,
  type BookingEmailData,
  type RefundStatement,
} from "./booking-emails";

/**
 * The emails a new booking sends: the customer's confirmation with its calendar
 * file (NOT-01), and the office's alert (NOT-03).
 *
 * Called after every successful fulfilment — by the webhook and by the return
 * page, which often both run for the same payment. The idempotency keys are
 * per booking, so Nuntly sends each email once however many times this runs.
 *
 * Never throws. A booking is a paid journey; an email provider being down must
 * not turn that into an error page or a webhook Stripe keeps retrying. Failures
 * are logged loudly for a person to follow up.
 */
export async function sendNewBookingNotifications(reference: string): Promise<void> {
  try {
    const data = await bookingEmailData(reference);
    if (!data) {
      console.error(`[notifications] ${reference}: booking not found, nothing sent`);
      return;
    }

    const confirmation = confirmationEmail(data.email);
    const office = officeNewBookingEmail(data.email);

    const [toCustomer, toOffice] = await Promise.all([
      sendEmail({
        to: data.email.customerEmail,
        ...confirmation,
        idempotencyKey: `booking-confirmation:${reference}`,
        audience: "customer",
        replyTo: company.email,
        attachments: [
          {
            filename: calendarFilename(reference),
            contentType: "text/calendar; charset=utf-8; method=PUBLISH",
            content: data.calendar,
          },
        ],
      }),
      data.officeAddress
        ? sendEmail({
            to: data.officeAddress,
            ...office,
            idempotencyKey: `office-new-booking:${reference}`,
            audience: "staff",
            replyTo: data.email.customerEmail,
          })
        : Promise.resolve<SendResult>({
            sent: false,
            reason: "OFFICE_ALERT_EMAIL is not set",
          }),
    ]);

    log(reference, "confirmation", toCustomer);
    log(reference, "office alert", toOffice);
  } catch (error) {
    console.error(`[notifications] ${reference}: sending failed`, error);
  }
}

/**
 * A customer changed their booking online: confirm it to them, and tell the
 * office, which may need to tell an assigned driver. `changeId` makes the pair
 * idempotent per change rather than per booking — a second change is new news.
 */
export async function sendBookingChangedNotifications(
  reference: string,
  changes: readonly BookingChange[],
  changeId: string,
): Promise<void> {
  await sendPair(reference, "change", (data) => [
    {
      to: data.email.customerEmail,
      ...bookingChangedEmail(data.email, changes),
      idempotencyKey: `booking-changed:${reference}:${changeId}`,
      audience: "customer",
      replyTo: company.email,
    },
    data.officeAddress
      ? {
          to: data.officeAddress,
          ...officeBookingChangedEmail(data.email, changes),
          idempotencyKey: `office-booking-changed:${reference}:${changeId}`,
          audience: "staff",
          replyTo: data.email.customerEmail,
        }
      : null,
  ]);
}

/** A customer cancelled online: confirm it, and give the office the refund to make. */
export async function sendBookingCancelledNotifications(
  reference: string,
  refund: RefundStatement,
): Promise<void> {
  await sendPair(reference, "cancellation", (data) => [
    {
      to: data.email.customerEmail,
      ...bookingCancelledEmail(data.email, refund),
      idempotencyKey: `booking-cancelled:${reference}`,
      audience: "customer",
      replyTo: company.email,
    },
    data.officeAddress
      ? {
          to: data.officeAddress,
          ...officeBookingCancelledEmail(data.email, refund),
          idempotencyKey: `office-booking-cancelled:${reference}`,
          audience: "staff",
          replyTo: data.email.customerEmail,
        }
      : null,
  ]);
}

/**
 * The manage link, sent again to the booking's own email address (BK-07).
 * Keyed to the hour so a customer who asks twice gets one email, and someone
 * hammering the form cannot turn it into a mail cannon.
 */
export async function sendManageLink(reference: string): Promise<void> {
  const hour = new Date().toISOString().slice(0, 13);
  await sendPair(reference, "manage link", (data) => [
    {
      to: data.email.customerEmail,
      ...manageLinkEmail(reference, data.email.manageUrl),
      idempotencyKey: `manage-link:${reference}:${hour}`,
      audience: "customer",
      replyTo: company.email,
    },
    null,
  ]);
}

/** Loads the booking, builds up to two emails, sends them, logs. Never throws. */
async function sendPair(
  reference: string,
  what: string,
  build: (
    data: NonNullable<Awaited<ReturnType<typeof bookingEmailData>>>,
  ) => [OutgoingEmail, OutgoingEmail | null],
): Promise<void> {
  try {
    const data = await bookingEmailData(reference);
    if (!data) {
      console.error(`[notifications] ${reference}: booking not found, no ${what} sent`);
      return;
    }

    const [toCustomer, toOffice] = build(data);
    const results = await Promise.all([
      sendEmail(toCustomer),
      toOffice ? sendEmail(toOffice) : Promise.resolve(null),
    ]);

    log(reference, `${what} email`, results[0]);
    if (results[1]) log(reference, `${what} office alert`, results[1]);
  } catch (error) {
    console.error(`[notifications] ${reference}: ${what} sending failed`, error);
  }
}

function log(reference: string, what: string, result: SendResult): void {
  if (result.sent) {
    const redirect = result.redirectedFrom
      ? ` (held for staff; was for ${result.redirectedFrom})`
      : "";
    console.info(`[notifications] ${reference}: ${what} sent, ${result.id}${redirect}`);
  } else {
    console.error(`[notifications] ${reference}: ${what} NOT sent — ${result.reason}`);
  }
}

async function bookingEmailData(reference: string): Promise<{
  email: BookingEmailData;
  calendar: string;
  officeAddress: string | null;
} | null> {
  const payload = await payloadClient();

  const found = await payload.find({
    collection: "bookings",
    where: { reference: { equals: reference } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const booking = found.docs[0];
  if (!booking) return null;

  const jobs = (
    await payload.find({
      collection: "jobs",
      where: { booking: { equals: booking.id } },
      sort: "pickupAt",
      limit: 10,
      overrideAccess: true,
    })
  ).docs;

  const customer =
    typeof booking.customer === "object" ? (booking.customer as Customer) : null;
  const vehicleName = (slug: string) =>
    VEHICLE_CLASSES.find((item) => item.slug === slug)?.name ?? slug;
  const extraName = (slug: string) =>
    EXTRAS.find((item) => item.slug === slug)?.name ?? slug;

  const origin = siteUrl();
  const manageUrl = `${origin}/manage/${reference}?t=${encodeURIComponent(manageTokenFor(reference))}`;
  const first = jobs[0];

  const email: BookingEmailData = {
    reference,
    totalPence: booking.totalPence,
    isTest: Boolean(booking.isTest),
    customerName: booking.bookerName ?? customer?.name ?? first?.leadName ?? "",
    customerEmail: booking.bookerEmail ?? customer?.email ?? first?.leadEmail ?? "",
    customerPhone: booking.bookerPhone ?? customer?.phone ?? first?.leadPhone ?? "",
    manageUrl,
    adminUrl: `${origin}/admin/collections/bookings/${booking.id}`,
    legs: jobs.map((job) => ({
      leg: job.leg === "return" ? "return" : "outbound",
      pickupAt: new Date(job.pickupAt),
      pickup: job.pickupAddress,
      dropoff: job.dropoffAddress ?? null,
      via: (job.viaStops ?? []).map((stop) => stop.address),
      hours: job.hours ?? null,
      flightNumber: job.flightNumber ?? null,
      vehicleName: vehicleName(job.vehicleClassSlug),
      passengers: job.passengers,
      largeBags: job.largeBags,
      nameBoard: job.nameBoardText ?? job.leadName,
    })),
    // Extras are recorded per job; the outbound's are the booking's.
    extras: (first?.extras ?? []).map((extra) => ({
      name: extraName(extra.slug),
      quantity: extra.quantity,
    })),
    notes: first?.driverNotes ?? null,
  };

  const calendar = buildCalendar(
    calendarEventsForJobs(reference, jobs, manageUrl, vehicleName),
    new Date(),
  );

  return { email, calendar, officeAddress: process.env.OFFICE_ALERT_EMAIL ?? null };
}
