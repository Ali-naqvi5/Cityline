import type { CollectionConfig } from "payload";

/**
 * Every webhook we have already processed (§14 `webhook_events`).
 *
 * The unique index on (provider, eventId) is the whole point. Stripe and
 * WhatsApp both deliver at least once, sometimes more, and a retry must not
 * create a second booking or send a second confirmation email. Insert here
 * first; if it collides, the event has been seen and there is nothing to do.
 */
export const WebhookEvents: CollectionConfig = {
  slug: "webhook-events",
  admin: {
    useAsTitle: "eventId",
    defaultColumns: ["provider", "type", "eventId", "processedAt"],
    description: "Idempotency ledger. One row per event we have handled.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "provider",
      type: "select",
      required: true,
      options: [
        { label: "Stripe", value: "stripe" },
        { label: "WhatsApp", value: "whatsapp" },
      ],
    },
    { name: "eventId", type: "text", required: true, index: true },
    { name: "type", type: "text", required: true },
    { name: "processedAt", type: "date" },
    { name: "payload", type: "json" },
  ],
  indexes: [{ fields: ["provider", "eventId"], unique: true }],
};
