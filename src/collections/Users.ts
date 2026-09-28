import type { CollectionConfig } from "payload";

/**
 * Staff accounts for the admin (ADM-03).
 *
 * Roles are defined now because access control on every other collection reads
 * them; the screens each role needs arrive in S8–S10. Two-factor is still to
 * come and is required before the admin carries real data (ADM-03).
 */
export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role"] },
  access: {
    // Only the owner may create or delete staff accounts.
    create: ({ req }) => req.user?.role === "owner",
    delete: ({ req }) => req.user?.role === "owner",
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => req.user?.role === "owner",
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "controller",
      options: [
        {
          label: "Owner — everything, including finance and bank details",
          value: "owner",
        },
        {
          label: "Controller — jobs, drivers, vehicles; no company finance",
          value: "controller",
        },
        { label: "Accounts — finance and statements", value: "accounts" },
        { label: "Editor — content only", value: "editor" },
      ],
    },
    { name: "active", type: "checkbox", defaultValue: true },
    { name: "lastLoginAt", type: "date", admin: { readOnly: true } },
  ],
};
