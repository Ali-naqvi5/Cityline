import type { CollectionConfig } from "payload";

import { allowAny } from "@/access/staff";
import {
  DOCUMENT_LABELS,
  VEHICLE_DOCUMENT_TYPES,
  type DocumentType,
} from "@/domain/compliance/documents";

import { auditChanges } from "./hooks/audit";
import { requireExpiryForExpiringTypes } from "./hooks/documents";

/**
 * A vehicle's documents (VEH-02, CMP-10): PHV vehicle licence, MOT,
 * hire-and-reward insurance, V5C, service records. As with drivers, renewals
 * are new documents and the latest counts. Never deleted.
 */
interface DocumentDoc {
  id: number;
  type: string;
  vehicle: number | { id: number; registration?: string | null };
}

export const VehicleDocuments: CollectionConfig = {
  slug: "vehicle-documents",
  admin: {
    useAsTitle: "type",
    defaultColumns: ["vehicle", "type", "expiresAt", "verifiedAt"],
  },
  access: {
    read: allowAny("compliance.view", "vehicles.view"),
    create: allowAny("vehicles.edit", "compliance.verify"),
    update: allowAny("vehicles.edit", "compliance.verify"),
    delete: () => false,
  },
  hooks: {
    beforeValidate: [requireExpiryForExpiringTypes],
    afterChange: [
      auditChanges<DocumentDoc>({
        label: (doc) => {
          const vehicle =
            typeof doc.vehicle === "object"
              ? (doc.vehicle.registration ?? `vehicle ${doc.vehicle.id}`)
              : `vehicle ${doc.vehicle}`;
          return `${DOCUMENT_LABELS[doc.type as DocumentType] ?? doc.type} — ${vehicle}`;
        },
      }),
    ],
  },
  fields: [
    {
      name: "vehicle",
      type: "relationship",
      relationTo: "vehicles",
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      required: true,
      index: true,
      options: VEHICLE_DOCUMENT_TYPES.map((value) => ({
        value,
        label: DOCUMENT_LABELS[value],
      })),
    },
    { name: "number", type: "text" },
    { name: "issuedAt", type: "date" },
    { name: "expiresAt", type: "date", index: true },
    { name: "file", type: "upload", relationTo: "private-files" },
    { name: "verifiedBy", type: "relationship", relationTo: "users" },
    { name: "verifiedAt", type: "date" },
    { name: "notes", type: "textarea" },
  ],
};
