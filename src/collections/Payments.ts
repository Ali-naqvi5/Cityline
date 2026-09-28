import type { CollectionConfig } from "payload";

/**
 * Money taken (§14 `payments`, PAY-01).
 *
 * `stripePaymentIntentId` is unique, and that uniqueness is the idempotency
 * guard: Stripe delivers webhooks at least once, and a duplicate must change
 * nothing. CLAUDE.md puts it plainly — webhooks are the source of truth for
 * payment status, not anything the browser reports.
 *
 * Nothing here is writable by hand. A payment record exists because Stripe
 * said so.
 */
export const Payments: CollectionConfig = {
  slug: "payments",
  admin: {
    useAsTitle: "stripePaymentIntentId",
    defaultColumns: ["booking", "amountPence", "status", "kind", "createdAt"],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // written by the Stripe webhook
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "booking", type: "relationship", relationTo: "bookings", index: true },
    { name: "job", type: "relationship", relationTo: "jobs" },
    {
      name: "stripePaymentIntentId",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    { name: "amountPence", type: "number", required: true },
    {
      name: "feePence",
      type: "number",
      defaultValue: 0,
      admin: { description: "Stripe's fee, needed for net revenue (§7)." },
    },
    { name: "status", type: "text", required: true, index: true },
    {
      name: "kind",
      type: "select",
      required: true,
      defaultValue: "initial",
      options: [
        { label: "Initial payment", value: "initial" },
        { label: "Amendment", value: "amendment" },
        { label: "After the trip", value: "post_trip" },
        { label: "Payment link", value: "payment_link" },
      ],
    },
    {
      name: "raw",
      type: "json",
      admin: { description: "The Stripe object as received, for reconciliation." },
    },
  ],
};
