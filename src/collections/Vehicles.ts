import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

import { auditChanges } from "./hooks/audit";

/**
 * Vehicles (VEH-01, §14 `vehicles`). The registration is stored without
 * spaces in capitals and is unique; it is copied onto each job at assignment
 * (CMP-03), so the register keeps the plate that was used on the day.
 */
export function normaliseRegistration(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

interface VehicleDoc {
  id: number;
  registration: string;
}

export const Vehicles: CollectionConfig = {
  slug: "vehicles",
  admin: {
    useAsTitle: "registration",
    defaultColumns: ["registration", "make", "model", "vehicleClassSlug", "status"],
  },
  access: {
    read: allow("vehicles.view"),
    create: allow("vehicles.edit"),
    update: allow("vehicles.edit"),
    delete: () => false, // job records name vehicles (CMP-03); mark sold
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && typeof data.registration === "string") {
          data.registration = normaliseRegistration(data.registration);
        }
        return data;
      },
    ],
    afterChange: [auditChanges<VehicleDoc>({ label: (doc) => doc.registration })],
  },
  fields: [
    { name: "registration", type: "text", required: true, unique: true, index: true },
    { name: "make", type: "text", required: true },
    { name: "model", type: "text", required: true },
    { name: "colour", type: "text", required: true },
    {
      name: "vehicleClassSlug",
      type: "select",
      required: true,
      index: true,
      options: VEHICLE_CLASSES.map((vehicle) => ({
        value: vehicle.slug,
        label: vehicle.name,
      })),
    },
    { name: "seats", type: "number", min: 1, max: 20 },
    {
      name: "ownership",
      type: "select",
      required: true,
      defaultValue: "driver",
      options: [
        { label: "Company-owned", value: "company" },
        { label: "Driver-owned", value: "driver" },
        { label: "Hired", value: "hired" },
      ],
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Off the road", value: "off_road" },
        { label: "Sold or returned", value: "sold" },
      ],
    },
    {
      name: "drivers",
      type: "relationship",
      relationTo: "drivers",
      hasMany: true,
      admin: { description: "Drivers who normally use this vehicle." },
    },
    { name: "notes", type: "textarea" },
  ],
};
