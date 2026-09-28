import type { CollectionConfig } from "payload";

import { bookingRules } from "@/domain/booking/rules";

/**
 * A priced journey, held server-side while the customer finishes booking
 * (§14 `quotes`, BK-08).
 *
 * This is what replaces the httpOnly cookie that currently carries step 3's
 * passenger details to step 4. The cookie was always an interim: it meant the
 * price and the personal details lived in the browser, where neither can be
 * trusted and the price cannot be re-checked.
 *
 * Two rules it exists to enforce:
 *
 *   BK-08 — quotes expire after 30 minutes. A customer who leaves the tab open
 *   over lunch is re-quoted rather than charged a stale price, and the funnel
 *   has an "expired" state to show them (§7).
 *
 *   "Prices are ALWAYS recalculated server-side" — the total charged at step 4
 *   comes from `results` here, not from anything the browser sends.
 *
 * `request` and `results` are JSON on purpose. The pricing engine's shape is
 * still to be written (S2), and a quote is a snapshot of what we told someone
 * at a moment in time — it should not silently change when the engine does.
 */
export const Quotes: CollectionConfig = {
  slug: "quotes",
  admin: {
    useAsTitle: "token",
    defaultColumns: ["token", "status", "totalPence", "expiresAt"],
    description: "Priced journeys awaiting checkout. Expire after 30 minutes.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // created by the funnel, never by hand
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "token",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          "Opaque, random. The only thing that travels in the URL between steps.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "open",
      index: true,
      options: [
        { label: "Open", value: "open" },
        { label: "Converted to a booking", value: "converted" },
        { label: "Expired", value: "expired" },
      ],
    },
    {
      name: "expiresAt",
      type: "date",
      required: true,
      index: true,
      admin: {
        description: `Set to ${bookingRules().quoteTtlMinutes} minutes after creation (BK-08).`,
      },
    },
    {
      name: "request",
      type: "json",
      required: true,
      admin: {
        description:
          "The journey as asked for: service mode, legs, party, extras. A FunnelParams snapshot.",
      },
    },
    {
      name: "results",
      type: "json",
      required: true,
      admin: {
        description: "What we quoted, per vehicle class, with the line breakdown.",
      },
    },
    {
      name: "totalPence",
      type: "number",
      required: true,
      admin: {
        description:
          "The chosen vehicle's total, in integer pence (NFR-08). Denormalised from `results` so the admin can sort on it.",
      },
    },
    {
      name: "customer",
      type: "relationship",
      relationTo: "customers",
      admin: { description: "Set once step 3 collects the passenger details." },
    },
    {
      name: "stripeCheckoutSessionId",
      type: "text",
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          "The Stripe Checkout Session paying for this quote (PAY-01). One per quote, ever: reusing it is what stops a reloaded payment page opening a second session that could be paid twice.",
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
