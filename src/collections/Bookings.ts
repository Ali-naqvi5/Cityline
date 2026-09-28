import type { CollectionConfig } from "payload";

/**
 * A website order (§14 `bookings`).
 *
 * The distinction between a booking and a job matters and is easy to lose: the
 * **booking** is the commercial record — what the customer agreed to and paid
 * for. The **jobs** are the journeys that get driven, one per leg. A return
 * booking is one booking and two jobs, and cancelling the booking cancels both
 * (§7).
 *
 * Only checkout creates these (§2). The staff job form cannot, which is what
 * stops the same website booking being entered twice — once by Stripe's
 * webhook and once by hand.
 *
 * `manageTokenHash` is the magic link (BK-07). The token itself is never
 * stored: it goes in the confirmation email and we keep only its hash, so a
 * leaked database does not hand over every customer's booking.
 */
export const Bookings: CollectionConfig = {
  slug: "bookings",
  admin: {
    useAsTitle: "reference",
    defaultColumns: ["reference", "status", "totalPence", "createdAt"],
    description: "Website orders. Created by checkout only.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // BK-09: created by the Stripe webhook, never by hand
    update: ({ req }) => Boolean(req.user),
    delete: () => false, // DATA-11: archived, never deleted
  },
  fields: [
    {
      name: "reference",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "CL-XXXXXX, from domain/booking/reference.ts. Read down the phone, so the alphabet excludes I, L, O and U.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending_payment",
      index: true,
      options: [
        { label: "Pending payment", value: "pending_payment" },
        { label: "Confirmed", value: "confirmed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Completed", value: "completed" },
        { label: "Expired", value: "expired" },
      ],
    },
    { name: "customer", type: "relationship", relationTo: "customers", required: true },
    { name: "quote", type: "relationship", relationTo: "quotes" },

    {
      type: "collapsible",
      label: "Booker",
      fields: [
        {
          name: "bookerName",
          type: "text",
          admin: {
            description:
              "Only set when the booker is not the travelling passenger (BK-04).",
          },
        },
        { name: "bookerPhone", type: "text" },
        { name: "bookerEmail", type: "email" },
      ],
    },

    {
      type: "collapsible",
      label: "Money",
      fields: [
        { name: "subtotalPence", type: "number", required: true },
        { name: "discountPence", type: "number", required: true, defaultValue: 0 },
        { name: "totalPence", type: "number", required: true },
        {
          name: "priceSnapshot",
          type: "json",
          required: true,
          admin: {
            description:
              "What the customer was shown and agreed to, line by line. Kept even if the pricing engine changes afterwards — CMP-02 requires the agreed fare to be recorded.",
          },
        },
      ],
    },

    {
      name: "termsVersion",
      type: "text",
      admin: {
        description:
          "Which version of the terms was accepted at checkout (CMP-11). Needed to answer 'what did they agree to?' months later.",
      },
    },
    {
      name: "manageTokenHash",
      type: "text",
      index: true,
      admin: {
        readOnly: true,
        description:
          "Hash of the magic-link token (BK-07). The token itself is emailed and never stored.",
      },
    },

    { name: "cancelledAt", type: "date" },
    { name: "cancelReason", type: "textarea" },
    {
      name: "archivedAt",
      type: "date",
      admin: {
        description:
          "DATA-11: finance and TfL records are archived, never deleted. Kept 12 months (TfL) and 6 years (accounting).",
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
