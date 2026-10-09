import { ValidationError, type CollectionConfig, type FieldAccess } from "payload";

import { allow, hiddenUnlessOwner } from "@/access/staff";
import { normalisePhone } from "@/domain/booking/passenger";
import { DRIVER_ENGAGEMENTS } from "@/domain/compliance/documents";
import { isValidNiNumber, normaliseNiNumber } from "@/domain/fleet/driver-record";
import { staffCan, type StaffIdentity } from "@/domain/staff/permissions";

import { auditChanges } from "./hooks/audit";

/**
 * Drivers (DRV-01, DRV-04, §14 `drivers`).
 *
 * The phone is the driver's WhatsApp number, stored as E.164 and unique:
 * messages go only to a verified number (WA-05), and two drivers cannot share
 * one. Bank details are sealed (`lib/sealed.ts`) and readable by the owner
 * and Accounts, who pay the drivers — never controllers (spec §22, widened by
 * Cityline on 6 Oct 2026).
 *
 * There are no pay rules here: what a driver is paid is agreed per booking and
 * written on the booking (`jobs.driverPricePence`).
 *
 * The record also holds what TfL requires of every driver available to an
 * operator (`domain/fleet/driver-record.ts`): National Insurance number,
 * photograph, and the dates they became and stopped being available. It is
 * never deleted — TfL wants it kept 12 months after the driver stops.
 */

const bankDetailsAccess: FieldAccess = ({ req }) =>
  staffCan(req.user as StaffIdentity | null, "drivers.bankDetails");

// The National Insurance number is for TfL's record, kept by those who keep
// the record (owner, controller) — not everyone who can see a driver.
const recordAccess: FieldAccess = ({ req }) =>
  staffCan(req.user as StaffIdentity | null, "drivers.edit");

interface DriverDoc {
  id: number;
  fullName?: string | null;
}

export const Drivers: CollectionConfig = {
  slug: "drivers",
  admin: {
    hidden: hiddenUnlessOwner,
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
        if (typeof data.nationalInsuranceNumber === "string") {
          data.nationalInsuranceNumber =
            normaliseNiNumber(data.nationalInsuranceNumber) || null;
        }
        return data;
      },
    ],
    beforeChange: [
      // TfL's record needs the date a driver stopped being available: asked
      // for when they are marked as left, and kept from then on.
      ({ data, originalDoc, collection, req }) => {
        const leaving =
          data.status === "left" &&
          (originalDoc?.status !== "left" || Boolean(originalDoc?.endDate));
        if (leaving && !data.endDate) {
          throw new ValidationError({
            collection: collection.slug,
            errors: [
              {
                path: "endDate",
                message:
                  "Enter the date they stopped being available — TfL needs it on the driver's record.",
              },
            ],
            req,
          });
        }
        return data;
      },
    ],
    afterChange: [
      auditChanges<DriverDoc>({
        label: (doc) => doc.fullName ?? `Driver ${doc.id}`,
        redact: ["bankDetailsSealed", "bankAccountLast4", "nationalInsuranceNumber"],
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
    {
      name: "nationalInsuranceNumber",
      type: "text",
      validate: (value: string | null | undefined) =>
        !value ||
        isValidNiNumber(value) ||
        "Enter a valid National Insurance number, such as AB 12 34 56 C.",
      access: { read: recordAccess, create: recordAccess, update: recordAccess },
      admin: { description: "Part of TfL's driver record. Stored as AB123456C." },
    },
    { name: "photo", type: "upload", relationTo: "private-files" },
    {
      // Registered: everything kept online. Outsourced: found for a job the
      // regulars cannot cover; copies of their documents kept offline.
      name: "engagement",
      type: "select",
      required: true,
      defaultValue: "registered",
      index: true,
      options: Object.entries(DRIVER_ENGAGEMENTS).map(([value, label]) => ({
        value,
        label,
      })),
    },
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
    {
      name: "startDate",
      type: "date",
      admin: { description: "When they became available to Cityline (TfL record)." },
    },
    {
      name: "endDate",
      type: "date",
      admin: { description: "When they stopped being available (TfL record)." },
    },
    { name: "leftReason", type: "textarea" },
    {
      name: "leftForConduct",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description:
          "Stopped because of their conduct driving a PHV: TfL must be told within 14 days (form PHV/105).",
      },
    },
    { name: "tflToldAt", type: "date", admin: { description: "When TfL was told." } },
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
