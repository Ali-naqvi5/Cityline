import { APIError, type CollectionConfig, type FieldAccess } from "payload";

import { allow } from "@/access/staff";

import { auditChanges } from "./hooks/audit";
import { staffCan, type StaffIdentity } from "@/domain/staff/permissions";

/**
 * Staff accounts for the admin (ADM-03). Who may do what is the permission
 * matrix in `domain/staff/permissions.ts`.
 *
 * Every member of staff can read the staff list — job records name who took
 * and who dispatched each job — and change their own name and password. Only
 * the Owner creates accounts, sets roles, or deactivates someone.
 *
 * A deactivated account cannot log in, and loses access at once even if its
 * session has not expired: every permission check asks `active` too.
 *
 * Two-factor authentication arrives with the staff screens.
 */
const ownerOnly: FieldAccess = ({ req }) =>
  staffCan(req.user as StaffIdentity | null, "staff.manage");

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    // Payload's defaults, stated because the specification requires them:
    // five wrong passwords lock the account for ten minutes.
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  admin: { useAsTitle: "name", defaultColumns: ["name", "email", "role", "active"] },
  access: {
    read: allow("dashboard"),
    create: allow("staff.manage"),
    delete: () => false, // deactivate instead; job records name staff (CMP-03)
    update: ({ req, id }) =>
      staffCan(req.user as StaffIdentity | null, "staff.manage") ||
      (Boolean(req.user) && req.user?.id === id),
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if (user?.active === false) {
          throw new APIError(
            "This account has been deactivated. Ask the owner to reactivate it.",
            403,
            undefined,
            true,
          );
        }
      },
    ],
    afterChange: [
      auditChanges<{ id: number; name?: string | null; email: string }>({
        label: (doc) => doc.name || doc.email,
        ignore: [
          "lastLoginAt",
          "loginAttempts",
          "lockUntil",
          "resetPasswordToken",
          "resetPasswordExpiration",
          "hash",
          "salt",
        ],
      }),
    ],
    afterLogin: [
      async ({ req, user }) => {
        await req.payload.update({
          collection: "users",
          id: user.id,
          data: { lastLoginAt: new Date().toISOString() },
          overrideAccess: true,
          req,
        });
      },
    ],
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "controller",
      access: { update: ownerOnly },
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
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      access: { update: ownerOnly },
    },
    {
      name: "lastLoginAt",
      type: "date",
      admin: {
        readOnly: true,
        // Written at each login; meaningless on a form creating the account.
        condition: (data) => Boolean(data?.id),
      },
    },
  ],
};
