import type { CollectionConfig, FieldAccess } from "payload";

import { allow } from "@/access/staff";
import { normalisePhone } from "@/domain/booking/passenger";
import { staffCan, type StaffIdentity } from "@/domain/staff/permissions";

import { auditChanges } from "./hooks/audit";

/**
 * Drivers (DRV-01, DRV-04, §14 `drivers`).
 *
 * The phone is the driver's WhatsApp number, stored as E.164 and unique:
 * messages go only to a verified number (WA-05), and two drivers cannot share
 * one. Bank details are sealed (`lib/sealed.ts`) and readable by the owner
 * alone — not controllers, not accounts (spec §22).
 *
 * There are no pay rules here: what a driver is paid is agreed per booking and
 * written on the booking (`jobs.driverPricePence`).
 */

const bankDetailsAccess: FieldAccess = ({ req }) =>
  staffCan(req.user as StaffIdentity | null, "drivers.bankDetails");

interface DriverDoc {
  id: number;
  fullName?: string | null;
}

export const Drivers: CollectionConfig = {
  slug: "drivers",
  admin: {
    useAsTitle: "fullName",
    defaultColumns: ["fullName", "status", "phone"],
  },
  access: {
    read: allow("drivers.view"),
    create: allow("drivers.edit"),
    update: allow("drivers.edit"),
    delete: () => false, // job records name drivers (CMP-03); set status "left"
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        if (typeof data.firstName === "string" || typeof data.lastName === "string") {
          data.fullName = `${data.firstName ?? ""} ${data.lastName ?? ""}`
            .replace(/\s+/g, " ")
            .trim();
        }
        if (typeof data.phone === "string") {
          data.phone = normalisePhone(data.phone) ?? data.phone;
        }
        return data;
      },
    ],
    afterChange: [
      auditChanges<DriverDoc>({
        label: (doc) => doc.fullName ?? `Driver ${doc.id}`,
        redact: ["bankDetailsSealed", "bankAccountLast4"],
        ignore: ["fullName"],
      }),
    ],
  },
  fields: [
    { name: "firstName", type: "text", required: true },
    { name: "lastName", type: "text", required: true },
    {
      name: "fullName",
      type: "text",
      index: true,
      admin: { readOnly: true, description: "Set from the first and last name." },
    },
    {
      name: "phone",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "WhatsApp number, stored as +44…" },
    },
    { name: "email", type: "email" },
    { name: "address", type: "textarea" },
    { name: "dateOfBirth", type: "date" },
    { name: "photo", type: "upload", relationTo: "private-files" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "active",
      index: true,
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Left", value: "left" },
      ],
    },
    { name: "startDate", type: "date" },
    { name: "endDate", type: "date" },
    {
      name: "whatsappConsentAt",
      type: "date",
      admin: {
        description: "When the driver agreed to receive jobs on WhatsApp (WA-05).",
      },
    },
    {
      name: "bankDetailsSealed",
      type: "text",
      access: {
        read: bankDetailsAccess,
        create: bankDetailsAccess,
        update: bankDetailsAccess,
      },
      admin: { hidden: true },
    },
    {
      name: "bankAccountLast4",
      type: "text",
      access: {
        read: bankDetailsAccess,
        create: bankDetailsAccess,
        update: bankDetailsAccess,
      },
      admin: { readOnly: true },
    },
    { name: "notes", type: "textarea" },
  ],
};
