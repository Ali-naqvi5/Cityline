import type { CollectionConfig, Field } from "payload";

import { allow, hiddenUnlessOwner } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import { RECEIPT_METHODS, receiptReference } from "@/domain/finance/supplier-money";

import { auditChanges } from "./hooks/audit";
import {
  failOn,
  linkBookings,
  linkPenalties,
  onlyChange,
  partnerLines,
  partnerPenaltyLines,
} from "./hooks/partner-lines";

/**
 * Money received from a partner (Supplier Money, approved by Cityline,
 * 6 Oct 2026), against the bookings it covers. The lines and total come from
 * the bookings; a booking is paid for once. The partner's penalties it was
 * short by are taken off, each once (Cityline, 16 Oct 2026), so its amount is
 * what reached the bank. Never edited or deleted — voided, with a reason,
 * which frees its bookings and penalties. Owner and Accounts.
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

/** The partner penalties a receipt takes off, or an invoice shows, as they were then. */
const PENALTY_FIELDS: Field[] = [
  {
    name: "penalty",
    type: "relationship",
    relationTo: "partner-penalties",
    required: true,
  },
  { name: "penaltyReference", type: "text" },
  { name: "jobReference", type: "text" },
  { name: "supplierReference", type: "text" },
  { name: "penalisedAt", type: "date" },
  { name: "reason", type: "text" },
  { name: "amountPence", type: "number" },
];

export const SupplierPayments: CollectionConfig = {
  slug: "supplier-payments",
  admin: {
    hidden: hiddenUnlessOwner,
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
        const penalties = await partnerPenaltyLines(
          req,
          "supplier-payments",
          supplierId!,
          data.penalties,
          "supplierPayment",
        );
        const bookingsPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
        const penaltiesPence = penalties.reduce((sum, line) => sum + line.amountPence, 0);
        if (penaltiesPence > bookingsPence) {
          fail(
            "penalties",
            "The penalties come to more than the bookings. Untick some penalties.",
          );
        }
        data.lines = lines;
        data.penalties = penalties;
        data.bookingsPence = bookingsPence;
        data.penaltiesPence = penaltiesPence;
        data.amountPence = bookingsPence - penaltiesPence;
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
        await linkPenalties(req, "supplierPayment", doc, previousDoc, operation);
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
    { name: "penalties", type: "array", fields: PENALTY_FIELDS },
    {
      name: "bookingsPence",
      type: "number",
      admin: {
        description: "The bookings' prices. Empty on receipts before 16 Oct 2026.",
      },
    },
    {
      name: "penaltiesPence",
      type: "number",
      admin: { description: "Partner penalties taken off." },
    },
    {
      name: "amountPence",
      type: "number",
      admin: { description: "Received: the bookings less the penalties taken off." },
    },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};

export { LINE_FIELDS, PENALTY_FIELDS };
