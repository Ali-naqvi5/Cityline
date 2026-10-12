"use server";

import { redirect } from "next/navigation";

import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { staffForAction } from "@/admin/guard";
import { relId } from "@/domain/dispatch/assignment";
import { isDone, isFinal } from "@/domain/jobs/status";
import { sendManageLink } from "@/domain/notifications/send-booking-notifications";
import type { Booking, Job } from "@/payload-types";

/**
 * Cancelling a website booking for a customer who asks the office (Cityline,
 * 10 Oct 2026): the order and every journey still to come, with the reason,
 * all in one go, as the customer's own online cancellation does. Journeys
 * already done stay as they are; a passenger on board stops it.
 *
 * No money moves here. The refund is made in Stripe and recorded on the
 * payment; until then the booking waits under Refunds as "cancelled, paid,
 * nothing refunded". The customer is not emailed.
 */
export async function cancelWebsiteBookingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("bookings.amend");
  const jobId = Number(text(formData, "jobId"));
  const reason = text(formData, "reason");
  if (!reason) {
    return { errors: { reason: "Say why the booking is cancelled." }, message: "" };
  }

  const as = { user, overrideAccess: false as const };
  const job = Number.isInteger(jobId)
    ? ((await payload.findByID({
        collection: "jobs",
        id: jobId,
        depth: 0,
        disableErrors: true,
        ...as,
      })) as Job | null)
    : null;
  const bookingId = job ? relId(job.booking) : null;
  if (!job || job.source !== "website" || !bookingId) {
    return { errors: {}, message: "Only a website booking is cancelled here." };
  }
  const booking = (await payload.findByID({
    collection: "bookings",
    id: bookingId,
    depth: 0,
    disableErrors: true,
    ...as,
  })) as Booking | null;
  if (!booking || booking.status !== "confirmed") {
    return {
      errors: {},
      message: "This booking is not open, so it cannot be cancelled.",
    };
  }

  const legs = (
    await payload.find({
      collection: "jobs",
      where: { booking: { equals: bookingId } },
      sort: "pickupAt",
      pagination: false,
      depth: 0,
      ...as,
    })
  ).docs as Job[];
  const onBoard = legs.find((leg) => leg.status === "on_board");
  if (onBoard) {
    return {
      errors: {},
      message: `The passenger is on board ${onBoard.reference}. Complete it, or step it back, first.`,
    };
  }
  const open = legs.filter((leg) => !isFinal(leg.status));

  const transactionID = await payload.db.beginTransaction();
  const req =
    transactionID === null || transactionID === undefined ? undefined : { transactionID };
  try {
    for (const leg of open) {
      await payload.update({
        collection: "jobs",
        id: leg.id,
        data: { status: "cancelled", cancelReason: reason },
        context: { cancellingOrder: true },
        req,
        ...as,
      });
    }
    await payload.update({
      collection: "bookings",
      id: bookingId,
      data: {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelReason: reason,
      },
      req,
      ...as,
    });
    if (req) await payload.db.commitTransaction(req.transactionID);
  } catch (error) {
    if (req) await payload.db.rollbackTransaction(req.transactionID);
    return payloadErrors(error, "cancelling a website booking");
  }

  redirect(`/admin/jobs/${job.id}?notice=order-cancelled`);
}

/**
 * Deleting a website booking: the Owner's alone, and only before any journey
 * on it is done (Cityline, 13 Oct 2026). Nothing is erased. The order and
 * its journeys are cancelled if they were not already, then archived: kept
 * for TfL's records and the accounts, and left out of every operations
 * screen and report. Its payment stays under Payments, so a refund can still
 * be made and recorded. The reason goes on each journey's history.
 */
export async function deleteWebsiteBookingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("bookings.delete");
  const jobId = Number(text(formData, "jobId"));
  const reason = text(formData, "reason");
  if (!reason) {
    return { errors: { reason: "Say why the booking is deleted." }, message: "" };
  }

  const as = { user, overrideAccess: false as const };
  const job = Number.isInteger(jobId)
    ? ((await payload.findByID({
        collection: "jobs",
        id: jobId,
        depth: 0,
        disableErrors: true,
        ...as,
      })) as Job | null)
    : null;
  const bookingId = job ? relId(job.booking) : null;
  if (!job || job.source !== "website" || !bookingId) {
    return { errors: {}, message: "Only a website booking is deleted here." };
  }
  const booking = (await payload.findByID({
    collection: "bookings",
    id: bookingId,
    depth: 0,
    disableErrors: true,
    ...as,
  })) as Booking | null;
  if (!booking || booking.archivedAt) {
    return { errors: {}, message: "This booking is already deleted." };
  }

  const legs = (
    await payload.find({
      collection: "jobs",
      where: { booking: { equals: bookingId } },
      pagination: false,
      depth: 0,
      ...as,
    })
  ).docs as Job[];
  const done = legs.find((leg) => isDone(leg.status));
  if (done) {
    return {
      errors: {},
      message: `${done.reference} is ${done.status === "no_show" ? "a PNS" : "completed"}. A booking with work done on it is never deleted.`,
    };
  }
  const onBoard = legs.find((leg) => leg.status === "on_board");
  if (onBoard) {
    return {
      errors: {},
      message: `The passenger is on board ${onBoard.reference}. A booking under way is not deleted.`,
    };
  }

  const at = new Date().toISOString();
  const transactionID = await payload.db.beginTransaction();
  const req =
    transactionID === null || transactionID === undefined ? undefined : { transactionID };
  try {
    for (const leg of legs) {
      await payload.update({
        collection: "jobs",
        id: leg.id,
        data:
          leg.status === "cancelled"
            ? { archivedAt: at }
            : { status: "cancelled", cancelReason: `Deleted: ${reason}`, archivedAt: at },
        context: { cancellingOrder: true },
        req,
        ...as,
      });
      await payload.create({
        collection: "job-events",
        data: {
          job: leg.id,
          type: "updated",
          field: "deleted",
          newValue: `Booking deleted: ${reason}`,
          actorType: "user",
          actorUser: user.id,
        },
        req,
        ...as,
      });
    }
    await payload.update({
      collection: "bookings",
      id: bookingId,
      data: {
        status: "cancelled",
        cancelledAt: booking.cancelledAt ?? at,
        cancelReason: booking.cancelReason ?? `Deleted: ${reason}`,
        archivedAt: at,
      },
      req,
      ...as,
    });
    if (req) await payload.db.commitTransaction(req.transactionID);
  } catch (error) {
    if (req) await payload.db.rollbackTransaction(req.transactionID);
    return payloadErrors(error, "deleting a website booking");
  }

  redirect("/admin/bookings?notice=booking-deleted");
}

/**
 * Emails the customer their Manage booking link again (spec §11), to the
 * address on the booking — never to one typed here. Needs the right to amend
 * bookings, checked on the server whatever the page showed.
 */
export async function resendManageLinkAction(formData: FormData): Promise<void> {
  const { payload, user } = await staffForAction("bookings.amend");
  const jobId = Number(formData.get("jobId"));
  if (!Number.isInteger(jobId)) redirect("/admin/bookings");

  const job = await payload.findByID({
    collection: "jobs",
    id: jobId,
    depth: 1,
    user,
    overrideAccess: false,
  });
  const booking =
    typeof job.booking === "object" ? (job.booking as Booking | null) : null;
  if (!booking) redirect(`/admin/jobs/${jobId}?notice=no-booking`);
  // A deleted booking has nothing left for the customer to manage.
  if (booking.archivedAt) redirect(`/admin/jobs/${jobId}`);

  const result = await sendManageLink(booking.reference);

  // Recorded either way: a failed attempt is history too.
  await payload.create({
    collection: "job-events",
    data: {
      job: job.id,
      type: "message_sent",
      field: "manageLink",
      newValue: result.sent
        ? "Manage booking link emailed to the customer"
        : `Manage booking link NOT sent: ${result.reason}`,
      actorType: "user",
      actorUser: user.id,
    },
    user,
    overrideAccess: false,
  });

  redirect(`/admin/jobs/${jobId}?notice=${result.sent ? "link-sent" : "link-failed"}`);
}
