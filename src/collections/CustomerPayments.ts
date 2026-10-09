import type { CollectionConfig } from "payload";

import { allow, hiddenUnlessOwner } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import {
  CUSTOMER_PAYMENT_METHODS,
  customerPaymentReference,
  PAID_BY_HAND,
} from "@/domain/finance/customer-money";
import { PAYMENT_METHOD_LABELS } from "@/domain/jobs/labels";
import { splitPence } from "@/domain/money";
import type { Customer, Job } from "@/payload-types";

import { auditChanges } from "./hooks/audit";
import { failOn, onlyChange } from "./hooks/partner-lines";

/**
 * A customer's money for office bookings paid by card link, bank transfer or
 * on account (Payments, approved by Cityline, 6 Oct 2026), recorded by hand
 * against the bookings it covers. The lines and total come from the bookings
 * themselves, and a booking is paid for once. A card fee, if the office
 * enters one, is shared across the bookings and comes off profit.
 *
 * Never edited or deleted: a mistake is voided, with a reason, which frees
 * its bookings — once any refunds against it are voided first. Owner and
 * Accounts.
 */

interface CustomerPaymentDoc {
  id: number;
  lines?: { job?: unknown; amountPence?: number | null }[] | null;
  feePence?: number | null;
  voidedAt?: string | null;
}

const routeOf = (job: Job) =>
  `${job.pickupAddress} to ${
    job.dropoffAddress ?? (job.hours ? `hourly hire, ${job.hours} hours` : "as directed")
  }`;

export const CustomerPayments: CollectionConfig = {
  slug: "customer-payments",
  admin: {
    hidden: hiddenUnlessOwner,
    defaultColumns: ["paidAt", "amountPence", "method"],
    description:
      "Customers' money for office bookings, recorded by hand. Voided, never edited or deleted.",
  },
  access: {
    read: allow("payments.view"),
    create: allow("payments.record"),
    update: allow("payments.record"), // voiding only
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === "update") {
          const checked = onlyChange("customer-payments", [])({ data, originalDoc, req });
          if (checked.voidedAt && !originalDoc?.voidedAt) {
            const refunds = await req.payload.count({
              collection: "refunds",
              where: {
                and: [
                  { customerPayment: { equals: originalDoc.id } },
                  { voidedAt: { exists: false } },
                ],
              },
              overrideAccess: true,
              req,
            });
            if (refunds.totalDocs) {
              failOn("customer-payments", req)(
                "voidReason",
                "This payment has refunds recorded against it. Void them first.",
              );
            }
          }
          return checked;
        }

        const fail = failOn("customer-payments", req);
        if (!data.paidAt) fail("paidAt", "Enter the date it was paid.");
        if (!(String(data.method) in CUSTOMER_PAYMENT_METHODS)) {
          fail("method", "Choose how it was paid.");
        }
        const ids = [
          ...new Set(
            ((data.lines ?? []) as { job?: unknown }[])
              .map((line) => relId(line.job))
              .filter((id): id is number => id !== null),
          ),
        ];
        if (ids.length === 0) fail("lines", "Choose at least one booking.");
        const found = await req.payload.find({
          collection: "jobs",
          where: { id: { in: ids } },
          pagination: false,
          depth: 1,
          overrideAccess: true,
          req,
        });
        if (found.docs.length !== ids.length) {
          fail("lines", "One of those bookings is not on record.");
        }
        const jobs = (found.docs as Job[]).sort((a, b) =>
          a.pickupAt.localeCompare(b.pickupAt),
        );
        for (const job of jobs) {
          if (job.isTest) fail("lines", `${job.reference} is a test booking.`);
          if (!(PAID_BY_HAND as readonly string[]).includes(job.paymentMethod)) {
            fail(
              "lines",
              `${job.reference} is paid ${(PAYMENT_METHOD_LABELS[job.paymentMethod] ?? job.paymentMethod).toLowerCase()}, not marked paid here.`,
            );
          }
          if (job.status === "cancelled") fail("lines", `${job.reference} is cancelled.`);
          if (relId(job.customerPayment))
            fail("lines", `${job.reference} is already paid.`);
        }

        const lines = jobs.map((job) => {
          const customer =
            job.customer && typeof job.customer === "object"
              ? (job.customer as Customer)
              : null;
          return {
            job: job.id,
            jobReference: job.reference,
            customerName: (customer?.name ?? job.leadName ?? "").slice(0, 200) || null,
            pickupAt: job.pickupAt,
            route: routeOf(job).slice(0, 300),
            amountPence: job.customerPricePence ?? 0,
          };
        });
        const amountPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
        const fee = data.feePence ?? null;
        if (fee !== null && (!Number.isInteger(fee) || fee < 0 || fee >= amountPence)) {
          fail("feePence", "The card fee must be less than the amount paid.");
        }
        data.lines = lines;
        data.amountPence = amountPence;
        data.feePence = fee || null;
        data.recordedBy = req.user?.id ?? null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      // Each booking points at the money that paid for it, with the price
      // then and its share of any card fee; voiding frees them.
      async ({ doc, previousDoc, operation, req }) => {
        const payment = doc as CustomerPaymentDoc;
        const voided =
          operation === "update" && payment.voidedAt && !previousDoc?.voidedAt;
        if (operation !== "create" && !voided) return doc;
        const lines = payment.lines ?? [];
        const fees = splitPence(
          payment.feePence ?? 0,
          lines.map((line) => line.amountPence ?? 0),
        );
        for (const [index, line] of lines.entries()) {
          const jobId = relId(line.job);
          if (!jobId) continue;
          await req.payload.update({
            collection: "jobs",
            id: jobId,
            data: voided
              ? {
                  customerPayment: null,
                  customerPaidPricePence: null,
                  paymentFeePence: 0,
                }
              : {
                  customerPayment: payment.id,
                  customerPaidPricePence: line.amountPence ?? null,
                  paymentFeePence: fees[index] ?? 0,
                },
            overrideAccess: true,
            req,
          });
        }
        return doc;
      },
      auditChanges<{ id: number }>({ label: (doc) => customerPaymentReference(doc.id) }),
    ],
  },
  fields: [
    { name: "paidAt", type: "date", required: true, index: true },
    {
      name: "method",
      type: "select",
      required: true,
      options: Object.entries(CUSTOMER_PAYMENT_METHODS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      name: "reference",
      type: "text",
      admin: { description: "The bank's or Stripe's reference, if any." },
    },
    {
      name: "paidBy",
      type: "text",
      admin: { description: "Who paid, if not the customer — a company, say." },
    },
    {
      name: "feePence",
      type: "number",
      min: 0,
      admin: { description: "What Stripe kept on a card payment link, if any." },
    },
    { name: "notes", type: "textarea" },
    {
      name: "lines",
      type: "array",
      fields: [
        { name: "job", type: "relationship", relationTo: "jobs", required: true },
        { name: "jobReference", type: "text" },
        { name: "customerName", type: "text" },
        { name: "pickupAt", type: "date" },
        { name: "route", type: "text" },
        { name: "amountPence", type: "number" },
      ],
    },
    { name: "amountPence", type: "number" },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
