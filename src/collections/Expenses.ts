import type { CollectionConfig } from "payload";

import { allow, hiddenUnlessOwner } from "@/access/staff";

import { auditChanges } from "./hooks/audit";
import { failOn, onlyChange } from "./hooks/partner-lines";

/**
 * Cityline's own expenses (approved by Cityline, 6 Oct 2026), entered by hand
 * one by one: what, when, how much, to whom, and how it was paid, with the
 * receipt if there is one. Cityline is a middle man taking a commission —
 * fuel, repairs, insurance and licensing are the drivers' own costs, never
 * these — so there are no categories and nothing repeats by itself.
 *
 * Entered by the Controller and Accounts. Never edited or deleted: a mistake
 * is voided, with a reason, and entered again. Comes off profit.
 */

export const EXPENSE_METHODS = {
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
} as const;
export type ExpenseMethod = keyof typeof EXPENSE_METHODS;

/** "EX-000004" — an expense's reference, from its record. */
export function expenseReference(id: number): string {
  return `EX-${String(id).padStart(6, "0")}`;
}

export const Expenses: CollectionConfig = {
  slug: "expenses",
  admin: {
    hidden: hiddenUnlessOwner,
    useAsTitle: "description",
    defaultColumns: ["spentAt", "description", "amountPence"],
    description: "Cityline's own expenses. Voided, never edited or deleted.",
  },
  access: {
    read: allow("expenses.view"),
    create: allow("expenses.manage"),
    update: allow("expenses.manage"), // voiding only
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation, req }) => {
        if (operation === "update") {
          return onlyChange("expenses", [])({ data, originalDoc, req });
        }
        const fail = failOn("expenses", req);
        if (!Number.isInteger(data.amountPence) || data.amountPence <= 0) {
          fail("amountPence", "Enter the amount, more than nothing.");
        }
        data.recordedBy = req.user?.id ?? null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      auditChanges<{ id: number }>({ label: (doc) => expenseReference(doc.id) }),
    ],
  },
  fields: [
    { name: "spentAt", type: "date", required: true, index: true },
    { name: "description", type: "text", required: true, maxLength: 200 },
    { name: "amountPence", type: "number", required: true, min: 1 },
    { name: "paidTo", type: "text", maxLength: 120 },
    {
      name: "method",
      type: "select",
      options: Object.entries(EXPENSE_METHODS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    { name: "receipt", type: "upload", relationTo: "private-files" },
    { name: "notes", type: "textarea" },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
