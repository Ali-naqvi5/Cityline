"use server";

import { redirect } from "next/navigation";

import { staffForAction } from "@/admin/guard";
import { sendManageLink } from "@/domain/notifications/send-booking-notifications";
import type { Booking } from "@/payload-types";

/**
 * Emails the customer their Manage booking link again (spec §11), to the
 * address on the booking — never to one typed here. Needs the right to amend
 * bookings, checked on the server whatever the page showed.
 */
export async function resendManageLinkAction(formData: FormData): Promise<void> {
  const { payload, user } = await staffForAction("bookings.amend");
  const jobId = Number(formData.get("jobId"));
  if (!Number.isInteger(jobId)) redirect("/admin/jobs");

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
