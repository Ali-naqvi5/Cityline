import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";

import { auditChanges } from "./hooks/audit";

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
 *
 * Website checkout creates customers, and so does the office: a phone,
 * WhatsApp or email booking is linked to the customer with that phone or
 * email, or to a new one (`domain/customers/link.ts`), so a regular has one
 * history however they book. Those may have no email, so it is optional.
 * Supplier passengers are the supplier's customers and are not recorded here.
 */
export const Customers: CollectionConfig = {
  slug: "customers",
  admin: { useAsTitle: "name", defaultColumns: ["name", "phone", "email"] },
  access: {
    read: allow("customers.view"),
    create: allow("customers.edit"),
    update: allow("customers.edit"),
    delete: () => false, // DATA-11: never permanently deleted
  },
  hooks: {
    afterChange: [
      auditChanges<{ id: number; name: string; email?: string | null }>({
        label: (doc) => doc.name || doc.email || `Customer ${doc.id}`,
      }),
    ],
  },
  fields: [
    { name: "email", type: "email", unique: true, index: true },
    { name: "name", type: "text", required: true },
    /** E.164, normalised by `domain/booking/passenger.ts`. */
    { name: "phone", type: "text", required: true, index: true },
    { name: "marketingConsent", type: "checkbox", defaultValue: false },
    { name: "marketingConsentAt", type: "date" },
    { name: "stripeCustomerId", type: "text", index: true },
    {
      name: "notes",
      type: "textarea",
      admin: {
        description:
          "Office notes: always needs a child seat, VIP, flights often delayed. Never shown to the customer.",
      },
    },
    {
      name: "isTest",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "PRD-07: excluded from reports and TfL exports." },
    },
  ],
};
