import { z } from "zod";

import { passengerDetailsSchema } from "./passenger";

/**
 * Shared shape for the step 3 → step 4 handover.
 *
 * Kept out of the server-action module because a `"use server"` file may only
 * export async functions — a constant or a type exported alongside them makes
 * the whole module export nothing.
 */

/**
 * Holds the in-progress booking between step 3 and payment.
 * httpOnly, so the details never reach client JavaScript, and scoped to /book
 * so it is not sent with every request to the rest of the site.
 *
 * TODO(S3): replaced by a quote token once the `quotes` table exists (BK-08).
 */
export const DETAILS_COOKIE = "cityline_booking_details";

export interface DetailsFormState {
  /** Field name → first error message, for rendering beside each input. */
  errors: Record<string, string>;
  /** Set when something failed that is not tied to one field. */
  message?: string;
}

/**
 * Re-validated whenever the cookie is read, so a stale cookie from an older
 * release, or one someone has edited, cannot feed bad data into a booking.
 */
export const bookingDraftSchema = z.object({
  details: passengerDetailsSchema,
  extras: z.record(z.string(), z.number().int().min(0)).default({}),
});

export type BookingDraft = z.infer<typeof bookingDraftSchema>;

/** Pulls `extra_<slug>` quantities out of the step 3 form. */
export function extrasFromFormData(formData: FormData): Record<string, number> {
  const extras: Record<string, number> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("extra_")) continue;

    const quantity = Number(value);
    if (Number.isInteger(quantity) && quantity > 0) {
      extras[key.slice("extra_".length)] = quantity;
    }
  }

  return extras;
}
