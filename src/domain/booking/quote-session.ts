import { z } from "zod";

import { funnelParamsSchema } from "./funnel-params";
import { passengerDetailsSchema } from "./passenger";
import { bookingRules } from "./rules";

/**
 * The step 3 → step 4 handover (BK-08).
 *
 * What this replaces, and why: the passenger's name, email and phone used to
 * travel in an httpOnly cookie. That kept them out of the URL — which mattered,
 * because a URL carrying a phone number ends up in browser history, in
 * `Referer` headers sent to Stripe and Google, in access logs and in any link
 * the customer forwards — but it left two things wrong:
 *
 *   The price lived in the browser. BK-08 and CLAUDE.md both require the
 *   server to recalculate it, and it cannot recalculate from something the
 *   client could have edited.
 *
 *   Nothing expired. A customer who left the tab open over lunch could pay
 *   yesterday's price, and §7's "quote expired" state had nothing to trigger
 *   it.
 *
 * Now the whole in-progress booking is a `quotes` row and only an opaque token
 * travels between the steps. The token identifies a quote; it carries no
 * personal data and reveals nothing if it leaks into a log.
 */

/**
 * URL-safe, unguessable, and not a booking reference.
 *
 * `CL-XXXXXX` references are deliberately short and readable because someone
 * reads them down the phone. This is the opposite: nobody types it, so it is
 * long enough that guessing one is not worth attempting. 32 bytes of
 * `crypto.getRandomValues`, base64url.
 */
export function createQuoteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** When a quote created now stops being honoured (BK-08). */
export function quoteExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + bookingRules().quoteTtlMinutes * 60_000);
}

export function isExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  const at = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return at.getTime() <= now.getTime();
}

/**
 * What a `quotes.request` holds — everything needed to rebuild the booking
 * without trusting anything from the browser.
 *
 * Re-validated on read, so a row written by an older release, or one somebody
 * has edited in the admin, cannot put bad data into a booking record.
 */
export const quoteRequestSchema = z.object({
  journey: funnelParamsSchema,
  details: passengerDetailsSchema,
  extras: z.record(z.string(), z.number().int().min(0)).default({}),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

/** What a `quotes.results` holds: the priced lines the customer was shown. */
export const quoteResultsSchema = z.object({
  vehicleSlug: z.string(),
  legs: z.number().int().min(1),
  lines: z.array(
    z.object({
      label: z.string(),
      detail: z.string().optional(),
      amountPence: z.number().int(),
    }),
  ),
  totalPence: z.number().int().min(0),
});

export type QuoteResults = z.infer<typeof quoteResultsSchema>;

export interface DetailsFormState {
  /** Field name → first error message, for rendering beside each input. */
  errors: Record<string, string>;
  /** Set when something failed that is not tied to one field. */
  message?: string;
}

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
