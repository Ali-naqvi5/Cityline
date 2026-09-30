import path from "node:path";

import type { CollectionConfig } from "payload";

import { allowAny } from "@/access/staff";

/**
 * Uploaded files that are not for the public: driver and vehicle documents,
 * driver photos, receipts (DATA-02, CMP-11).
 *
 * Stored in the storage volume, outside `public/` and outside the app image,
 * so a deploy cannot lose them and no URL reaches them directly. Payload
 * serves each file only after running this collection's `read` access for the
 * signed-in user — a controller can open a licence scan, an editor cannot,
 * and a visitor gets nothing.
 */
export const PrivateFiles: CollectionConfig = {
  slug: "private-files",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "purpose", "createdAt"],
    description: "Private uploads. Never public.",
  },
  access: {
    read: allowAny("compliance.view", "drivers.view", "vehicles.view", "expenses.view"),
    create: allowAny(
      "drivers.edit",
      "vehicles.edit",
      "compliance.verify",
      "expenses.manage",
    ),
    update: () => false,
    delete: () => false,
  },
  upload: {
    staticDir: path.resolve(process.env.STORAGE_PATH || "storage", "private"),
    mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  fields: [
    {
      name: "purpose",
      type: "select",
      required: true,
      defaultValue: "other",
      options: [
        { label: "Driver document", value: "driver_document" },
        { label: "Vehicle document", value: "vehicle_document" },
        { label: "Driver photo", value: "driver_photo" },
        { label: "Receipt", value: "receipt" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "uploadedBy", type: "relationship", relationTo: "users" },
  ],
};
