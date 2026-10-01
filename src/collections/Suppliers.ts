import type { CollectionConfig } from "payload";

import { allow, allowAny } from "@/access/staff";

import { auditChanges } from "./hooks/audit";

/**
 * Partner platforms that send Cityline jobs — Trip.com and others (§2,
 * §14 `suppliers`).
 *
 * No commission is recorded: partners take their cut before they send a job,
 * so the price on the job is what Cityline receives (Cityline, 2 Oct 2026).
 */
interface SupplierDoc {
  id: number;
  name: string;
}

export const Suppliers: CollectionConfig = {
  slug: "suppliers",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "paymentTermsDays", "active"],
  },
  access: {
    read: allowAny("suppliers.view", "supplierMoney.view"),
    create: allow("suppliers.edit"),
    update: allow("suppliers.edit"),
    delete: () => false, // jobs name suppliers; deactivate instead
  },
  hooks: {
    afterChange: [auditChanges<SupplierDoc>({ label: (doc) => doc.name })],
  },
  fields: [
    { name: "name", type: "text", required: true, unique: true, index: true },
    {
      name: "paymentTermsDays",
      type: "number",
      defaultValue: 30,
      min: 0,
      admin: { description: "Days after the trip the supplier normally pays." },
    },
    { name: "contactName", type: "text" },
    { name: "email", type: "email" },
    { name: "phone", type: "text" },
    { name: "dashboardUrl", type: "text" },
    { name: "notes", type: "textarea" },
    { name: "active", type: "checkbox", defaultValue: true, index: true },
  ],
};
