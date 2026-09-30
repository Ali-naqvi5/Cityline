import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";

/** Refunds against a payment (§14 `refunds`, PAY-02). */
export const Refunds: CollectionConfig = {
  slug: "refunds",
  admin: {
    useAsTitle: "stripeRefundId",
    defaultColumns: ["payment", "amountPence", "reason", "createdAt"],
  },
  access: {
    read: allow("refunds.view"),
    create: () => false, // written by the Stripe webhook
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "payment", type: "relationship", relationTo: "payments", required: true },
    { name: "stripeRefundId", type: "text", required: true, unique: true, index: true },
    { name: "amountPence", type: "number", required: true },
    { name: "reason", type: "textarea" },
    { name: "createdByUser", type: "relationship", relationTo: "users" },
  ],
};
