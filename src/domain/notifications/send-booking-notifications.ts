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
import { sendEmail, type SendResult } from "@/lib/email";
import { payloadClient } from "@/lib/payload";
import type { Customer } from "@/payload-types";

import {
  confirmationEmail,
  officeNewBookingEmail,
  type BookingEmailData,
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
