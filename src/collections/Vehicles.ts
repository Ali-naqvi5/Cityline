import { ValidationError, type CollectionConfig } from "payload";

import { allow } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

import { auditChanges } from "./hooks/audit";

/**
 * Vehicles (VEH-01, §14 `vehicles`). The registration is stored without
 * spaces in capitals and is unique; it is copied onto each job at assignment
 * (CMP-03), so the register keeps the plate that was used on the day.
 *
 * Every car is its driver's own (Cityline, 9 Oct 2026): drivers are
 * self-employed and Cityline owns no cars. A car belongs to exactly one
 * driver, and a driver has one car in use — adding a new one marks the old
 * one "no longer used", kept because past bookings name it.
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
    beforeChange: [
      ({ data, originalDoc, req }) => {
        const drivers = (data.drivers ?? originalDoc?.drivers ?? []) as unknown[];
        const ids = [...new Set(drivers.map(relId).filter((id) => id !== null))];
        if (ids.length !== 1) {
          throw new ValidationError({
            collection: "vehicles",
            errors: [
              {
                path: "drivers",
                message:
                  ids.length === 0
                    ? "Choose the driver whose car this is."
                    : "A car belongs to one driver only.",
              },
            ],
            req,
          });
        }
        data.drivers = ids;
        // Every car is its driver's own, whatever an older record said.
        data.ownership = "driver";
        return data;
      },
    ],
    afterChange: [
      // A driver has one car in use: their other cars are no longer used.
      async ({ doc, req }) => {
        if (doc.status === "sold") return doc;
        const driverId = relId((doc.drivers ?? [])[0]);
        if (!driverId) return doc;
        const others = await req.payload.find({
          collection: "vehicles",
          where: {
            and: [
              { drivers: { in: [driverId] } },
              { status: { not_equals: "sold" } },
              { id: { not_equals: doc.id } },
            ],
          },
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req,
        });
        for (const other of others.docs) {
          await req.payload.update({
            collection: "vehicles",
            id: other.id,
            data: { status: "sold" },
            overrideAccess: true,
            req,
          });
        }
        return doc;
      },
      auditChanges<VehicleDoc>({ label: (doc) => doc.registration }),
    ],
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
      // Kept for older records only: every car is its driver's own, so it is
      // never shown or asked for (Cityline, 9 Oct 2026).
      name: "ownership",
      type: "select",
      required: true,
      defaultValue: "driver",
      admin: { hidden: true },
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
        { label: "No longer used", value: "sold" },
      ],
    },
    {
      // One driver: the car is theirs. A list in the database for older
      // records; the hook above keeps it to exactly one.
      name: "drivers",
      label: "Driver",
      type: "relationship",
      relationTo: "drivers",
      hasMany: true,
      maxRows: 1,
      admin: { description: "The driver whose car this is." },
    },
    { name: "notes", type: "textarea" },
  ],
};
