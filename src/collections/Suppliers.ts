import type { CollectionConfig } from "payload";

import { allow, allowAny } from "@/access/staff";

import { auditChanges } from "./hooks/audit";

/**
 * Partner platforms that send Cityline jobs — Trip.com and others (§2,
 * §14 `suppliers`).
 *
 * The default commission is a setting (FIN-00): changing it applies to new
 * jobs only, because each job records the rate it was entered with. Every
 * change is in the audit log.
 */
interface SupplierDoc {
  id: number;
  name: string;
}

export const Suppliers: CollectionConfig = {
  slug: "suppliers",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "defaultCommissionBp", "paymentTermsDays", "active"],
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
      name: "defaultCommissionBp",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      max: 10_000,
      admin: { description: "Basis points: 1800 = 18%. New jobs start from this." },
    },
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
