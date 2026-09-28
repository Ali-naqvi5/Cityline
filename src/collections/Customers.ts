import type { CollectionConfig } from "payload";

/**
 * People who have booked (§14 `customers`).
 *
 * Not an account: BK-06 and §17 both settle on guest booking with a magic link,
 * so there is no password here. A customer row exists so a repeat booker is one
 * record rather than five, and so marketing consent has somewhere to live.
 *
 * Email is stored lower-cased by `passengerDetailsSchema` before it ever gets
 * here, which gives the unique index the case-insensitivity §14 asks for
 * without needing the citext extension.
 */
export const Customers: CollectionConfig = {
  slug: "customers",
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "phone"] },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // created by checkout, never by hand
    update: ({ req }) => Boolean(req.user),
    delete: () => false, // DATA-11: never permanently deleted
  },
  fields: [
    { name: "email", type: "email", required: true, unique: true, index: true },
    { name: "name", type: "text", required: true },
    /** E.164, normalised by `domain/booking/passenger.ts`. */
    { name: "phone", type: "text", required: true, index: true },
    { name: "marketingConsent", type: "checkbox", defaultValue: false },
    { name: "marketingConsentAt", type: "date" },
    { name: "stripeCustomerId", type: "text", index: true },
    {
      name: "isTest",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "PRD-07: excluded from reports and TfL exports." },
    },
  ],
};
