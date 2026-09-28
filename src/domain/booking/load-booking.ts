import "server-only";

import { payloadClient } from "@/lib/payload";
import type { Booking, Job } from "@/payload-types";

import { manageTokenMatches } from "./manage-token";
import { normaliseReference } from "./reference";

/**
 * Loads a booking for the confirmation screen and, later, Manage booking
 * (BK-07).
 *
 * The access rule is the part worth reading. `CL-7K4Q2P` is **not** a secret: it
 * is read down the phone, quoted in support chats and printed on receipts. So
 * the reference alone gets you nothing — every screen that shows a name, a phone
 * number or a home address also checks the magic-link token, of which only a
 * hash is stored.
 *
 * Three outcomes rather than a nullable row, because each needs a different
 * screen and `null` would flatten them into one:
 *
 *   `missing`      — no such reference. Indistinguishable, deliberately, from a
 *                    reference that exists: telling someone which of the two
 *                    they found turns this into an enumeration oracle.
 *   `unauthorised` — the reference is real but the token is wrong or absent.
 *                    Same response as `missing` to a stranger; the distinction
 *                    exists so the page can offer to resend the link.
 *   `ok`           — the booking and its jobs, one per leg.
 */
export type LoadedBooking =
  | { state: "missing" }
  | { state: "unauthorised" }
  | { state: "ok"; booking: Booking; jobs: Job[] };

export async function loadBooking(
  reference: string,
  manageToken: string,
): Promise<LoadedBooking> {
  // Accepts lower case, stray spaces and Crockford's ambiguous characters, so a
  // reference retyped off a phone screen still resolves.
  const canonical = normaliseReference(reference);
  if (!canonical) return { state: "missing" };

  const payload = await payloadClient();

  const found = await payload.find({
    collection: "bookings",
    where: { reference: { equals: canonical } },
    limit: 1,
    // Read before anyone authenticates: this is the customer holding a magic
    // link, not a logged-in member of staff.
    overrideAccess: true,
  });

  const booking = found.docs[0];
  if (!booking) return { state: "missing" };

  if (!manageTokenMatches(manageToken, booking.manageTokenHash ?? "")) {
    return { state: "unauthorised" };
  }

  const jobs = await payload.find({
    collection: "jobs",
    where: { booking: { equals: booking.id } },
    // Outbound before return, which is the order a passenger thinks in.
    sort: "pickupAt",
    limit: 10,
    overrideAccess: true,
  });

  return { state: "ok", booking, jobs: jobs.docs };
}
