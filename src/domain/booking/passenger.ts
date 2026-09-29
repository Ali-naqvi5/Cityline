import { z } from "@/lib/zod";

/**
 * Step 3 — who is travelling and how we reach them (BK-01, BK-04, BK-06).
 *
 * Phone numbers are normalised to E.164 on the way in. They are not decoration:
 * the driver's details go to this number by SMS before the journey (CMP-04,
 * NOT-02), and the office calls it when a passenger does not appear. A number
 * stored as "07700 900123" and a number stored as "+447700900123" are the same
 * person, and the system must not treat them as two.
 */

/**
 * Accepts what people actually type — "07700 900123", "+44 7700 900123",
 * "0044 7700 900123", "(07700) 900123" — and returns E.164, or null.
 *
 * UK numbers are assumed for bare national numbers starting 0, because that is
 * who books London airport transfers. International numbers must carry their
 * own country code, which is the honest trade: guessing a country for a bare
 * foreign number would produce a number that rings the wrong person.
 */
export function normalisePhone(input: string): string | null {
  const cleaned = input.replace(/[\s()\-.]/g, "");
  if (cleaned === "") return null;

  let e164: string;

  if (cleaned.startsWith("+")) {
    e164 = cleaned;
  } else if (cleaned.startsWith("00")) {
    e164 = `+${cleaned.slice(2)}`;
  } else if (cleaned.startsWith("0")) {
    e164 = `+44${cleaned.slice(1)}`;
  } else {
    return null;
  }

  // E.164: a leading +, a country code that cannot start with 0, and 8–15 digits.
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;

  return e164;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter a phone number")
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a phone number we can reach you on, including the area code",
      });
      return z.NEVER;
    }
    return normalised;
  });

const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(80, "That name is too long")
  // A name with no letters is a mistyped field, not a name.
  .refine((value) => /\p{L}/u.test(value), "Enter a name");

export const passengerDetailsSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    phone: phoneSchema,

    /** BK-04: the booker and the lead passenger can be different people. */
    bookingForSomeoneElse: z.boolean().default(false),
    passengerName: z.string().trim().max(160).optional(),
    passengerPhone: z.string().trim().optional(),

    notes: z.string().trim().max(500).optional(),
    marketingConsent: z.boolean().default(false),
    acceptedTerms: z.literal(true, {
      message: "Please accept the terms and conditions to continue",
    }),
  })
  .superRefine((value, ctx) => {
    if (!value.bookingForSomeoneElse) return;

    // The name goes on the driver's board and the phone is what the driver
    // rings on landing, so neither can be blank once this is ticked.
    if (!value.passengerName) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerName"],
        message: "Enter the name of the passenger travelling",
      });
    }

    if (!value.passengerPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerPhone"],
        message: "Enter a mobile number for the passenger travelling",
      });
    } else if (!normalisePhone(value.passengerPhone)) {
      ctx.addIssue({
        code: "custom",
        path: ["passengerPhone"],
        message: "Enter a mobile number we can reach the passenger on",
      });
    }
  });

export type PassengerDetails = z.infer<typeof passengerDetailsSchema>;

/**
 * The name the driver puts on the board (CMP-04 / WA-01). The passenger
 * travelling takes precedence over whoever paid.
 */
export function nameBoardText(details: {
  firstName: string;
  lastName: string;
  bookingForSomeoneElse?: boolean;
  passengerName?: string;
}): string {
  if (details.bookingForSomeoneElse && details.passengerName) {
    return details.passengerName;
  }
  return `${details.firstName} ${details.lastName}`.trim();
}
