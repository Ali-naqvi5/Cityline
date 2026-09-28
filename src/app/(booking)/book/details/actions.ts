"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DETAILS_COOKIE,
  extrasFromFormData,
  type DetailsFormState,
} from "@/domain/booking/details-session";
import { passengerDetailsSchema } from "@/domain/booking/passenger";

/**
 * Step 3 submit.
 *
 * Passenger details are deliberately NOT passed to step 4 in the query string.
 * A URL containing a name, email and phone number ends up in browser history,
 * in `Referer` headers sent to Stripe and Google, in server access logs, and in
 * any link the customer shares. They go in an httpOnly cookie instead.
 *
 * TODO(S3): this cookie is an interim. Once the `quotes` table exists (BK-08),
 * the in-progress booking is stored server-side against a quote token and the
 * cookie holds nothing but that token. The schema is re-validated on read, so
 * a tampered or stale cookie cannot put bad data into a booking record.
 *
 * A `"use server"` module may only export async functions, so the cookie name
 * and the form-state type live in `@/domain/booking/details-session`.
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

  const store = await cookies();
  store.set(
    DETAILS_COOKIE,
    JSON.stringify({ details: parsed.data, extras: extrasFromFormData(formData) }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/book",
      // Long enough to finish paying, short enough not to linger on a shared
      // computer. It is deleted once the booking is confirmed.
      maxAge: 60 * 60,
    },
  );

  const journey = String(formData.get("journeyQuery") ?? "");
  redirect(`/book/payment${journey ? `?${journey}` : ""}`);
}
