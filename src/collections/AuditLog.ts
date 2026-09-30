import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";

/**
 * Every change staff make to operational, compliance, finance and settings
 * records (ADM-04, spec §39). Written only by the `auditChanges` hook; nobody
 * can create, edit or delete a row through the API or the admin.
 */
export const AuditLog: CollectionConfig = {
  slug: "audit-log",
  admin: {
    useAsTitle: "docLabel",
    defaultColumns: ["createdAt", "entity", "docLabel", "action", "user"],
    description: "Append-only. Written by the system on every staff change.",
  },
  access: {
    read: allow("audit.view"),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "entity", type: "text", required: true, index: true },
    { name: "docId", type: "text", required: true, index: true },
    { name: "docLabel", type: "text" },
    {
      name: "action",
      type: "select",
      required: true,
      options: [
        { label: "Created", value: "create" },
        { label: "Updated", value: "update" },
        { label: "Deleted", value: "delete" },
      ],
    },
    { name: "changes", type: "json" },
    { name: "user", type: "relationship", relationTo: "users", index: true },
    { name: "role", type: "text" },
  ],
};
