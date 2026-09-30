import type { CollectionConfig } from "payload";

import { allowAny } from "@/access/staff";
import {
  DOCUMENT_LABELS,
  DRIVER_DOCUMENT_TYPES,
  type DocumentType,
} from "@/domain/compliance/documents";

import { auditChanges } from "./hooks/audit";
import { requireExpiryForExpiringTypes } from "./hooks/documents";

/**
 * A driver's documents (DRV-02, CMP-10): PHV licence, DVLA licence, DBS,
 * right to work. A renewal is a new document; the old one stays on record,
 * and the latest counts (`domain/compliance/documents.ts`). Never deleted.
 */
interface DocumentDoc {
  id: number;
  type: string;
  driver: number | { id: number; fullName?: string | null };
}

export const DriverDocuments: CollectionConfig = {
  slug: "driver-documents",
  admin: {
    useAsTitle: "type",
    defaultColumns: ["driver", "type", "expiresAt", "verifiedAt"],
  },
  access: {
    read: allowAny("compliance.view", "drivers.view"),
    create: allowAny("drivers.edit", "compliance.verify"),
    update: allowAny("drivers.edit", "compliance.verify"),
    delete: () => false,
  },
  hooks: {
    beforeValidate: [requireExpiryForExpiringTypes],
    afterChange: [
      auditChanges<DocumentDoc>({
        label: (doc) => {
          const driver =
            typeof doc.driver === "object"
              ? (doc.driver.fullName ?? `driver ${doc.driver.id}`)
              : `driver ${doc.driver}`;
          return `${DOCUMENT_LABELS[doc.type as DocumentType] ?? doc.type} — ${driver}`;
        },
      }),
    ],
  },
  fields: [
    {
      name: "driver",
      type: "relationship",
      relationTo: "drivers",
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      required: true,
      index: true,
      options: DRIVER_DOCUMENT_TYPES.map((value) => ({
        value,
        label: DOCUMENT_LABELS[value],
      })),
    },
    {
      name: "number",
      type: "text",
      admin: {
        description:
          "The PHV licence number is copied onto each job at assignment (CMP-03).",
      },
    },
    { name: "issuedAt", type: "date" },
    { name: "expiresAt", type: "date", index: true },
    { name: "file", type: "upload", relationTo: "private-files" },
    { name: "verifiedBy", type: "relationship", relationTo: "users" },
    { name: "verifiedAt", type: "date" },
    { name: "notes", type: "textarea" },
  ],
};
