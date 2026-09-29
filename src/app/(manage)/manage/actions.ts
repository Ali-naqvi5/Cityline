"use server";

import { redirect } from "next/navigation";

import { cancelBookingOnline, changeBooking } from "@/domain/booking/manage-booking";
import { normaliseReference } from "@/domain/booking/reference";
import {
  sendBookingCancelledNotifications,
  sendBookingChangedNotifications,
  sendManageLink,
} from "@/domain/notifications/send-booking-notifications";
import { company } from "@/lib/company";
import { payloadClient } from "@/lib/payload";
import { policies } from "@/lib/policies";
import type { Customer } from "@/payload-types";

import type { ManageFormState } from "./form-state";

/**
 * Manage booking's three form handlers (BK-07).
 *
 * The magic-link token arrives as a hidden field and is checked again inside
 * the domain functions — never trusted from the page that rendered the form.
 * Emails go out after the database has committed, and never block the reply.
 */

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

const manageUrl = (reference: string, token: string, flag: string) =>
  `/manage/${reference}?t=${encodeURIComponent(token)}&${flag}=1`;

const CALL_US = `Changes and cancellations close ${policies.freeCancellationHours} hours before pickup, when a driver may already be on the way. Please call us on ${company.phone} and we will sort it out.`;

export async function changeBookingAction(
  _previous: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const reference = field(formData, "reference");
  const token = field(formData, "token");

  const jobIds = formData.getAll("jobId").map(Number).filter(Number.isInteger);
  const result = await changeBooking(reference, token, {
    legs: jobIds.map((jobId) => ({
      jobId,
      date: field(formData, `date_${jobId}`),
      time: field(formData, `time_${jobId}`),
    })),
    flightNumber: field(formData, "flightNumber"),
    passengerName: field(formData, "passengerName"),
    passengerPhone: field(formData, "passengerPhone"),
    notes: field(formData, "notes"),
  });

  switch (result.state) {
    case "not_found":
      redirect("/manage");
    case "closed":
      return { errors: {}, message: CALL_US };
    case "invalid":
      return { errors: result.errors, message: "Please check the highlighted fields." };
    case "unchanged":
      return { errors: {}, message: "Nothing has changed — your booking is as it was." };
    case "changed":
      await sendBookingChangedNotifications(
        reference,
        result.changes,
        String(Date.now()),
      );
      redirect(manageUrl(reference, token, "updated"));
  }
}

export async function cancelBookingAction(
  _previous: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const reference = field(formData, "reference");
  const token = field(formData, "token");

  const result = await cancelBookingOnline(reference, token);

  switch (result.state) {
    case "not_found":
      redirect("/manage");
    case "closed":
      return { errors: {}, message: CALL_US };
    case "cancelled":
      await sendBookingCancelledNotifications(reference, result.refund);
      redirect(manageUrl(reference, token, "cancelled"));
  }
}

/**
 * "I have lost my link": emails it again to the address on the booking.
 *
 * The reply is identical whether or not anything matched. Saying "no booking
 * with that reference" would let anyone test which references exist; saying
 * "wrong email" would confirm the reference and invite guessing the address.
 * The link only ever goes to the booking's own email, never to the one typed.
 */
export async function requestManageLinkAction(
  _previous: ManageFormState,
  formData: FormData,
): Promise<ManageFormState> {
  const reference = normaliseReference(field(formData, "reference"));
  const email = field(formData, "email").trim().toLowerCase();

  const errors: Record<string, string> = {};
  if (!reference) errors.reference = "Enter your booking reference, which starts CL-";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter the email you booked with";
  if (Object.keys(errors).length) return { errors };

  const payload = await payloadClient();
  const found = await payload.find({
    collection: "bookings",
    where: { reference: { equals: reference } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });

  const booking = found.docs[0];
  const customer =
    booking && typeof booking.customer === "object"
      ? (booking.customer as Customer)
      : null;
  const onFile = [booking?.bookerEmail, customer?.email]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (reference && onFile.includes(email)) {
    await sendManageLink(reference);
  }

  return { errors: {}, sent: true };
}
