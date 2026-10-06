import type { CollectionConfig, Field } from "payload";

import { allow } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import { RECEIPT_METHODS, receiptReference } from "@/domain/finance/supplier-money";

import { auditChanges } from "./hooks/audit";
import { failOn, linkBookings, onlyChange, partnerLines } from "./hooks/partner-lines";

/**
 * Money received from a partner (Supplier Money, approved by Cityline,
 * 6 Oct 2026), against the bookings it covers. The lines and total come from
 * the bookings; a booking is paid for once. Never edited or deleted — voided,
 * with a reason, which frees its bookings. Owner and Accounts.
 */

/** The bookings a receipt or invoice covers, as they were then. */
const LINE_FIELDS: Field[] = [
  { name: "job", type: "relationship", relationTo: "jobs", required: true },
  { name: "jobReference", type: "text" },
  { name: "supplierReference", type: "text" },
  { name: "pickupAt", type: "date" },
  { name: "route", type: "text" },
  { name: "status", type: "text" },
  { name: "amountPence", type: "number" },
];

export const SupplierPayments: CollectionConfig = {
  slug: "supplier-payments",
  admin: {
    defaultColumns: ["supplier", "receivedAt", "amountPence"],
    description: "Money received from partners. Voided, never edited or deleted.",
  },
  access: {
    read: allow("supplierMoney.view"),
    create: allow("supplierMoney.manage"),
    update: allow("supplierMoney.manage"), // voiding only
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === "update") {
          return onlyChange("supplier-payments", [])({ data, originalDoc, req });
        }
        const fail = failOn("supplier-payments", req);
        const supplierId = relId(data.supplier);
        if (!supplierId) fail("supplier", "Choose the partner.");
        const lines = await partnerLines(
          req,
          "supplier-payments",
          supplierId!,
          data.lines,
          "supplierPayment",
        );
        data.lines = lines;
        data.amountPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
        data.recordedBy = req.user?.id ?? null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        await linkBookings(req, "supplierPayment", doc, previousDoc, operation);
        return doc;
      },
      auditChanges<{ id: number }>({ label: (doc) => receiptReference(doc.id) }),
    ],
  },
  fields: [
    {
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      required: true,
      index: true,
    },
    { name: "receivedAt", type: "date", required: true, index: true },
    {
      name: "method",
      type: "select",
      required: true,
      options: Object.entries(RECEIPT_METHODS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "reference",
      type: "text",
      admin: { description: "The partner's reference." },
    },
    { name: "notes", type: "textarea" },
    { name: "lines", type: "array", fields: LINE_FIELDS },
    { name: "amountPence", type: "number" },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};

export { LINE_FIELDS };
