import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import { invoiceNumber } from "@/domain/finance/supplier-money";
import type { Supplier } from "@/payload-types";

import { auditChanges } from "./hooks/audit";
import { failOn, linkBookings, onlyChange, partnerLines } from "./hooks/partner-lines";
import { LINE_FIELDS } from "./SupplierPayments";

/**
 * Invoices to partners (Supplier Money, approved by Cityline, 6 Oct 2026).
 * Made only when the office chooses, for the bookings it chooses, and sent by
 * the office — nothing here sends anything. The lines and total come from the
 * bookings; a booking is on one invoice at a time. Due after the partner's
 * payment terms. Never edited: marked sent, or voided with a reason.
 */

const DAY_MS = 86_400_000;

export const SupplierInvoices: CollectionConfig = {
  slug: "supplier-invoices",
  admin: {
    defaultColumns: ["supplier", "issuedAt", "totalPence", "sentAt"],
    description: "Invoices to partners. Voided, never edited or deleted.",
  },
  access: {
    read: allow("supplierMoney.view"),
    create: allow("supplierMoney.manage"),
    update: allow("supplierMoney.manage"), // marking sent, or voiding
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === "update") {
          return onlyChange("supplier-invoices", ["sentAt"])({ data, originalDoc, req });
        }
        const fail = failOn("supplier-invoices", req);
        const supplierId = relId(data.supplier);
        if (!supplierId) fail("supplier", "Choose the partner.");
        if (!data.issuedAt) fail("issuedAt", "Enter the invoice date.");
        const supplier = (await req.payload.findByID({
          collection: "suppliers",
          id: supplierId!,
          depth: 0,
          overrideAccess: true,
          req,
        })) as Supplier;
        const lines = await partnerLines(
          req,
          "supplier-invoices",
          supplierId!,
          data.lines,
          "supplierInvoice",
        );
        data.lines = lines;
        data.totalPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
        data.dueAt = new Date(
          new Date(String(data.issuedAt)).getTime() +
            (supplier.paymentTermsDays ?? 0) * DAY_MS,
        ).toISOString();
        data.createdBy = req.user?.id ?? null;
        data.sentAt = null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        await linkBookings(req, "supplierInvoice", doc, previousDoc, operation);
        return doc;
      },
      auditChanges<{ id: number }>({ label: (doc) => invoiceNumber(doc.id) }),
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
    { name: "issuedAt", type: "date", required: true, index: true },
    { name: "dueAt", type: "date" },
    { name: "notes", type: "textarea" },
    { name: "lines", type: "array", fields: LINE_FIELDS },
    { name: "totalPence", type: "number" },
    {
      name: "sentAt",
      type: "date",
      admin: { description: "When the office sent it. Nothing is sent automatically." },
    },
    { name: "createdBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
