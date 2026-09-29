import "server-only";

import type {
  BookingChange,
  RefundStatement,
} from "@/domain/notifications/booking-emails";
import { payloadClient } from "@/lib/payload";
import { formatDate, formatTime, londonToUtc } from "@/lib/time";
import type { Job } from "@/payload-types";

import { bookingWindowMessage } from "./booking-window";
import { checkPickupTiming, flightNumberSchema } from "./journey";
import { loadBooking } from "./load-booking";
import { canManageOnline, cancellationTerms, upcomingJobs } from "./manage-rules";
import { normalisePhone } from "./passenger";

/**
 * Changing and cancelling a booking from Manage booking (BK-07).
 *
 * Both start the same way: the magic-link token is checked, then the 24-hour
 * online window (`manage-rules.ts`). Both write in one transaction and leave a
 * `job_events` row for every field they touch, because these are the jobs TfL
 * inspects and a changed pickup time must show who changed it and when
 * (CMP-03). Neither moves money: refunds are made by the office (Cityline,
 * 29 Sep 2026), and nothing here changes the fare.
 */

export interface ChangeRequest {
  /** New date and time per job still to run, keyed by job id. */
  legs: { jobId: number; date: string; time: string }[];
  flightNumber: string;
  passengerName: string;
  passengerPhone: string;
  notes: string;
}

export type ChangeResult =
  | { state: "changed"; changes: BookingChange[] }
  | { state: "unchanged" }
  | { state: "invalid"; errors: Record<string, string> }
  | { state: "closed" }
  | { state: "not_found" };

export type CancelResult =
  | { state: "cancelled"; refund: RefundStatement }
  | { state: "closed" }
  | { state: "not_found" };

type PayloadClient = Awaited<ReturnType<typeof payloadClient>>;

const when = (at: Date) => `${formatDate(at)} at ${formatTime(at)}`;

function legLabel(job: Job, jobs: readonly Job[]): string {
  if (jobs.length < 2) return "Pickup";
  return job.leg === "return" ? "Return pickup" : "Outbound pickup";
}

export async function changeBooking(
  reference: string,
  token: string,
  request: ChangeRequest,
  now: Date = new Date(),
): Promise<ChangeResult> {
  const loaded = await loadBooking(reference, token);
  if (loaded.state !== "ok") return { state: "not_found" };

  const { booking, jobs } = loaded;
  if (!canManageOnline(booking.status, jobs, now)) return { state: "closed" };

  const errors: Record<string, string> = {};
  const upcoming = upcomingJobs(jobs);

  // --- Validate ------------------------------------------------------------
  const name = request.passengerName.trim();
  if (!name || name.length > 80 || !/\p{L}/u.test(name)) {
    errors.passengerName = "Enter the name of the passenger travelling";
  }

  const phone = normalisePhone(request.passengerPhone);
  if (!phone)
    errors.passengerPhone = "Enter a mobile number we can reach the passenger on";

  let flight = "";
  if (request.flightNumber.trim()) {
    const parsed = flightNumberSchema.safeParse(request.flightNumber);
    if (parsed.success) flight = parsed.data;
    else errors.flightNumber = "Enter a flight number such as BA117";
  }

  const notes = request.notes.trim();
  if (notes.length > 500) errors.notes = "Please keep notes under 500 characters";

  const newPickups = new Map<number, Date>();
  for (const job of upcoming) {
    const leg = request.legs.find((item) => item.jobId === job.id);
    const key = `pickup_${job.id}`;

    if (
      !leg ||
      !/^\d{4}-\d{2}-\d{2}$/.test(leg.date) ||
      !/^\d{2}:\d{2}$/.test(leg.time)
    ) {
      errors[key] = "Choose a date and time";
      continue;
    }

    const at = londonToUtc(leg.date, leg.time);
    const timing = checkPickupTiming(at, now);
    if (timing) {
      errors[key] = bookingWindowMessage({
        ...timing,
        leg: job.leg === "return" ? "return" : "outbound",
      });
      continue;
    }

    newPickups.set(job.id, at);
  }

  // A return must still follow the outbound.
  const outbound = upcoming.find((job) => job.leg !== "return");
  const back = upcoming.find((job) => job.leg === "return");
  const outboundAt =
    outbound && (newPickups.get(outbound.id) ?? new Date(outbound.pickupAt));
  const returnAt = back && (newPickups.get(back.id) ?? new Date(back.pickupAt));
  if (outboundAt && returnAt && returnAt.getTime() <= outboundAt.getTime() && back) {
    errors[`pickup_${back.id}`] =
      "The return journey needs to be after the outbound journey.";
  }

  if (Object.keys(errors).length) return { state: "invalid", errors };

  // --- Work out what actually changed -----------------------------------------
  const first = upcoming[0];
  const changes: BookingChange[] = [];
  type Update = {
    job: Job;
    data: Partial<Job>;
    events: { field: string; from: string; to: string }[];
  };
  const updates: Update[] = upcoming.map((job) => ({ job, data: {}, events: [] }));

  for (const update of updates) {
    const { job } = update;
    const at = newPickups.get(job.id);
    if (at && at.getTime() !== new Date(job.pickupAt).getTime()) {
      update.data.pickupAt = at.toISOString();
      update.events.push({ field: "pickupAt", from: job.pickupAt, to: at.toISOString() });
      changes.push({
        label: legLabel(job, jobs),
        from: when(new Date(job.pickupAt)),
        to: when(at),
      });
    }

    const currentName = job.nameBoardText ?? job.leadName;
    if (name !== currentName) {
      update.data.nameBoardText = name;
      update.data.leadName = name;
      update.events.push({ field: "nameBoardText", from: currentName, to: name });
    }

    if (phone && phone !== job.leadPhone) {
      update.data.leadPhone = phone;
      update.events.push({ field: "leadPhone", from: job.leadPhone, to: phone });
    }

    const currentNotes = job.driverNotes ?? "";
    if (notes !== currentNotes) {
      update.data.driverNotes = notes;
      update.events.push({ field: "driverNotes", from: currentNotes, to: notes });
    }

    // The flight belongs to the outbound — the leg that meets a plane.
    if (job.leg !== "return") {
      const currentFlight = job.flightNumber ?? "";
      if (flight !== currentFlight) {
        update.data.flightNumber = flight || null;
        update.events.push({ field: "flightNumber", from: currentFlight, to: flight });
      }
    }
  }

  // Booking-wide fields are listed once, not once per leg.
  if (first) {
    const currentName = first.nameBoardText ?? first.leadName;
    if (name !== currentName)
      changes.push({ label: "Passenger name", from: currentName, to: name });
    if (phone && phone !== first.leadPhone) {
      changes.push({ label: "Passenger phone", from: first.leadPhone, to: phone });
    }
    if (notes !== (first.driverNotes ?? "")) {
      changes.push({
        label: "Notes for the driver",
        from: first.driverNotes ?? "",
        to: notes,
      });
    }
  }
  if (outbound && flight !== (outbound.flightNumber ?? "")) {
    changes.push({
      label: "Flight number",
      from: outbound.flightNumber ?? "",
      to: flight,
    });
  }

  if (!changes.length) return { state: "unchanged" };

  // --- Write ---------------------------------------------------------------
  const payload = await payloadClient();
  await inTransaction(payload, async (req) => {
    for (const { job, data, events } of updates) {
      if (!events.length) continue;

      await payload.update({
        collection: "jobs",
        id: job.id,
        data,
        overrideAccess: true,
        req,
      });

      for (const event of events) {
        await payload.create({
          collection: "job-events",
          data: {
            job: job.id,
            type: "updated",
            field: event.field,
            oldValue: event.from,
            newValue: event.to,
            actorType: "customer",
          },
          overrideAccess: true,
          req,
        });
      }
    }
  });

  return { state: "changed", changes };
}

export async function cancelBookingOnline(
  reference: string,
  token: string,
  now: Date = new Date(),
): Promise<CancelResult> {
  const loaded = await loadBooking(reference, token);
  if (loaded.state !== "ok") return { state: "not_found" };

  const { booking, jobs } = loaded;
  if (!canManageOnline(booking.status, jobs, now)) return { state: "closed" };

  const terms = cancellationTerms(booking.totalPence, jobs, now);
  if (!terms) return { state: "closed" };

  const reason = "Cancelled online by the customer";
  const at = now.toISOString();
  const payload = await payloadClient();

  await inTransaction(payload, async (req) => {
    await payload.update({
      collection: "bookings",
      id: booking.id,
      data: { status: "cancelled", cancelledAt: at, cancelReason: reason },
      overrideAccess: true,
      req,
    });

    for (const job of upcomingJobs(jobs)) {
      await payload.update({
        collection: "jobs",
        id: job.id,
        data: { status: "cancelled", cancelledAt: at, cancelReason: reason },
        overrideAccess: true,
        req,
      });

      await payload.create({
        collection: "job-events",
        data: {
          job: job.id,
          type: "status_changed",
          field: "status",
          oldValue: job.status,
          newValue: "cancelled",
          actorType: "customer",
        },
        overrideAccess: true,
        req,
      });
    }
  });

  return {
    state: "cancelled",
    refund:
      terms.kind === "full"
        ? { kind: "full", refundPence: terms.refundPence }
        : { kind: "partial", refundPence: terms.refundPence },
  };
}

type TransactionReq = { transactionID: string | number } | undefined;

async function inTransaction(
  payload: PayloadClient,
  work: (req: TransactionReq) => Promise<void>,
): Promise<void> {
  const transactionID = await payload.db.beginTransaction();
  const req: TransactionReq =
    transactionID === null || transactionID === undefined ? undefined : { transactionID };

  try {
    await work(req);
    if (req) await payload.db.commitTransaction(req.transactionID);
  } catch (error) {
    if (req) await payload.db.rollbackTransaction(req.transactionID);
    throw error;
  }
}
