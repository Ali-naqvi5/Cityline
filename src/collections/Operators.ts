import { ValidationError, type CollectionConfig, type FieldAccess } from "payload";

import { allow, allowAny, hiddenUnlessOwner } from "@/access/staff";
import { LICENSED_FROM } from "@/domain/operators/operators";
import { staffCan, type StaffIdentity } from "@/domain/staff/permissions";

import { auditChanges } from "./hooks/audit";

/**
 * Subcontracting operators (Cityline, 15 Oct 2026): other licensed private
 * hire operators Cityline passes a booking to — see `domain/operators`. A
 * booking goes to a driver or to an operator, and runs the same stages
 * either way; the operator is paid in Driver Pay like a driver.
 *
 * Required: the name, who licensed them, and a contact phone. Never deleted —
 * bookings name them; a date left stops new bookings going to them.
 */

interface OperatorDoc {
  id: number;
  name: string;
}

// Bank details: the same people who see drivers' (Owner, Accounts).
const bankDetailsAccess: FieldAccess = ({ req }) =>
  staffCan(req.user as StaffIdentity | null, "drivers.bankDetails");

export const Operators: CollectionConfig = {
  slug: "operators",
  labels: { singular: "Subcontracting operator", plural: "Subcontracting operators" },
  admin: {
    hidden: hiddenUnlessOwner,
    useAsTitle: "name",
    defaultColumns: ["name", "licensedFrom", "licenceNumber", "phone"],
  },
  access: {
    // Driver Pay names the operators it pays.
    read: allowAny("operators.view", "driverPay.view"),
    create: allow("operators.edit"),
    update: allow("operators.edit"),
    delete: () => false,
  },
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        // Not TfL: which council or authority licensed them, for the record.
        if (
          data &&
          (data.licensedFrom === "council" || data.licensedFrom === "scotland") &&
          !String(data.licensingAuthority ?? "").trim()
        ) {
          throw new ValidationError({
            collection: "operators",
            errors: [
              {
                path: "licensingAuthority",
                message: "Enter the council or authority that licensed them.",
              },
            ],
            req,
          });
        }
        return data;
      },
    ],
    afterChange: [
      auditChanges<OperatorDoc>({
        label: (doc) => doc.name,
        redact: ["bankDetailsSealed", "bankAccountLast4"],
      }),
    ],
  },
  fields: [
    { name: "name", type: "text", required: true, index: true },
    {
      name: "legalName",
      type: "text",
      admin: { description: "The company's registered name, if different." },
    },
    {
      name: "licensedFrom",
      type: "select",
      required: true,
      defaultValue: "tfl",
      options: Object.entries(LICENSED_FROM).map(([value, label]) => ({ value, label })),
    },
    {
      name: "licensingAuthority",
      type: "text",
      admin: { description: "The council or authority, when not TfL." },
    },
    { name: "licenceNumber", type: "text" },
    { name: "licenceExpiresAt", type: "date" },
    {
      name: "licenceCopy",
      type: "upload",
      relationTo: "private-files",
      admin: { description: "A copy of their operator licence." },
    },
    {
      name: "operatingCentre",
      type: "textarea",
      admin: { description: "Where they take bookings." },
    },
    { name: "contactName", type: "text" },
    { name: "phone", type: "text", required: true },
    { name: "email", type: "email" },
    {
      name: "whatsappConsentAt",
      type: "date",
      admin: { description: "When they agreed to receive jobs on WhatsApp." },
    },
    { name: "dateJoined", type: "date" },
    {
      name: "dateLeft",
      type: "date",
      admin: { description: "No bookings go to them from this day." },
    },
    { name: "companyNumber", type: "text" },
    { name: "vatNumber", type: "text" },
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
