"use server";

import { redirect } from "next/navigation";

import { checkBookingAvailability } from "@/domain/booking/booking-availability";
import { bookingWindowMessage } from "@/domain/booking/booking-window";
import { largestParty, parseFunnelParams } from "@/domain/booking/funnel-params";
import { childSeatsExceedPassengers } from "@/domain/pricing/extras";
import { passengerDetailsSchema } from "@/domain/booking/passenger";
import {
  createQuoteToken,
  extrasFromFormData,
  quoteExpiresAt,
  type DetailsFormState,
} from "@/domain/booking/quote-session";
import { quoteFor } from "@/domain/pricing/quote";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { payloadClient } from "@/lib/payload";

/**
 * Step 3 submit: validate the passenger, price the journey, store it, move on.
 *
 * The price is worked out **here, on the server**, and written to the quote.
 * Step 4 charges what this row says, not what the browser sends — BK-08 and
 * CLAUDE.md are both explicit that a price from a client is never trusted.
 *
 * Only the quote token travels to step 4. No name, phone or email in the URL:
 * a URL with a phone number in it ends up in browser history, in `Referer`
 * headers sent to Stripe and Google, in access logs, and in any link the
 * customer forwards to someone.
 *
 * A `"use server"` module may only export async functions, so the token
 * helpers and the form-state type live in `@/domain/booking/quote-session`.
 */
export async function saveDetails(
  _previous: DetailsFormState,
  formData: FormData,
): Promise<DetailsFormState> {
  const parsed = passengerDetailsSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    bookingForSomeoneElse: formData.get("bookingForSomeoneElse") === "on",
    passengerName: formData.get("passengerName") || undefined,
    passengerPhone: formData.get("passengerPhone") || undefined,
    notes: formData.get("notes") || undefined,
    marketingConsent: formData.get("marketingConsent") === "on",
    acceptedTerms: formData.get("acceptedTerms") === "on",
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      // Keep the first message per field: a list of five complaints about one
      // input is noise, and the first is the one to fix.
      if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
    }
    return { errors };
  }

  // The journey is rebuilt from the query the form carries, then parsed with
  // the same function every other step uses — never read field by field here.
  const journeyQuery = new URLSearchParams(String(formData.get("journeyQuery") ?? ""));
  const journey = parseFunnelParams({
    ...Object.fromEntries(journeyQuery),
    via: journeyQuery.getAll("via"),
    returnVia: journeyQuery.getAll("returnVia"),
  });

  const vehicle = VEHICLE_CLASSES.find((item) => item.slug === journey.vehicle);
  if (!vehicle) {
    // No vehicle means a tampered or stale link; send them back to choose one
    // rather than guessing on their behalf.
    redirect(`/book/vehicle?${journeyQuery.toString()}`);
  }

  /*
   * BK-05, on the server. The form posts whatever the browser holds, and the
   * browser may have been open for an hour — so the date and time are checked
   * again here, not trusted from step 2.
   */
  const windowProblem = await checkBookingAvailability(journey);
  if (windowProblem) {
    return { errors: {}, message: bookingWindowMessage(windowProblem) };
  }

  const extras = extrasFromFormData(formData);

  // The form warns about this as you type; this is the rule. A child seat is
  // fitted for someone travelling, so there cannot be more seats than people.
  if (childSeatsExceedPassengers(extras, largestParty(journey).passengers)) {
    return {
      errors: {
        extras:
          "You have chosen more child seats than passengers. Please check the numbers.",
      },
    };
  }

  const quote = quoteFor(journey, vehicle, extras);
  const token = createQuoteToken();

  const payload = await payloadClient();
  await payload.create({
    collection: "quotes",
    data: {
      token,
      status: "open",
      expiresAt: quoteExpiresAt().toISOString(),
      request: { journey, details: parsed.data, extras },
      results: {
        vehicleSlug: vehicle.slug,
        legs: quote.legs,
        lines: quote.lines,
        totalPence: quote.totalPence,
      },
      totalPence: quote.totalPence,
    },
  });

  redirect(`/book/payment?q=${encodeURIComponent(token)}`);
}
