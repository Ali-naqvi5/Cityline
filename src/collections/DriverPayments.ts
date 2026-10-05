import { ValidationError, type CollectionConfig, type PayloadRequest } from "payload";

import { allow } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import {
  cashHeldPence,
  isPayable,
  PAYMENT_METHODS,
  paymentReference,
  payTotals,
  routeText,
  type PayJob,
} from "@/domain/finance/driver-pay";
import type { JobStatus } from "@/domain/jobs/labels";
import { londonToUtc } from "@/lib/time";
import type { Job } from "@/payload-types";

import { auditChanges } from "./hooks/audit";

/**
 * Payments to drivers (Driver Pay, approved by Cityline, 6 Oct 2026).
 *
 * Each one covers a set of bookings, picked up to a chosen date. The server
 * works out the lines and totals from the bookings themselves — the driver
 * price written on each, less any cash the driver collected — so nothing
 * typed can disagree with the bookings, and a booking already paid cannot be
 * paid again. Each covered booking points back at its payment.
 *
 * A payment is never edited or deleted: a mistake is voided, with a reason,
 * which frees its bookings to be paid again. Owner and Accounts.
 */

interface DriverPaymentDoc {
  id: number;
  driver?: unknown;
}

const fail = (req: PayloadRequest, path: string, message: string): never => {
  throw new ValidationError({
    collection: "driver-payments",
    errors: [{ path, message }],
    req,
  });
};

const VOID_FIELDS = new Set(["voidedAt", "voidReason", "voidedBy", "updatedAt"]);

export const DriverPayments: CollectionConfig = {
  slug: "driver-payments",
  admin: {
    defaultColumns: ["driver", "paidAt", "amountPence", "method"],
    description:
      "Payments to drivers for their bookings. Voided, never edited or deleted.",
  },
  access: {
    read: allow("driverPay.view"),
    create: allow("driverPay.manage"),
    update: allow("driverPay.manage"), // voiding only — see the hook
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === "update") {
          const original = (originalDoc ?? {}) as Record<string, unknown>;
          if (original.voidedAt) fail(req, "voidReason", "This payment is already void.");
          for (const [key, value] of Object.entries(data)) {
            if (VOID_FIELDS.has(key)) continue;
            if (JSON.stringify(value ?? null) !== JSON.stringify(original[key] ?? null)) {
              fail(
                req,
                key,
                "A payment cannot be changed. Void it, with a reason, and record it again.",
              );
            }
          }
          if (data.voidedAt || data.voidReason) {
            const reason = String(data.voidReason ?? "").trim();
            if (!reason) fail(req, "voidReason", "Write why this payment is void.");
            data.voidReason = reason;
            data.voidedAt = new Date().toISOString();
            data.voidedBy = req.user?.id ?? null;
          }
          return data;
        }

        // A new payment: its lines and totals come from the bookings.
        const driverId = relId(data.driver);
        if (!driverId) fail(req, "driver", "Choose the driver.");
        if (!data.upTo) fail(req, "upTo", "Choose the date the payment runs up to.");
        const before = londonToUtc(
          new Date(String(data.upTo)).toISOString().slice(0, 10),
          "23:59",
        );
        const ids = [
          ...new Set(
            ((data.lines ?? []) as { job?: unknown }[])
              .map((line) => relId(line.job))
              .filter((id): id is number => id !== null),
          ),
        ];
        if (ids.length === 0) fail(req, "lines", "Choose at least one booking to pay.");

        const found = await req.payload.find({
          collection: "jobs",
          where: { id: { in: ids } },
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req,
        });
        if (found.docs.length !== ids.length) {
          fail(req, "lines", "One of those bookings is not on record.");
        }
        const jobs: PayJob[] = (found.docs as Job[]).map((job) => ({
          id: job.id,
          reference: job.reference,
          status: job.status as JobStatus,
          pickupAt: job.pickupAt,
          pickupAddress: job.pickupAddress,
          dropoffAddress: job.dropoffAddress ?? null,
          hours: job.hours ?? null,
          driverPricePence: job.driverPricePence ?? null,
          paymentMethod: job.paymentMethod,
          customerPricePence: job.customerPricePence ?? null,
          driverPaymentId: relId(job.driverPayment),
          driverPaidPricePence: job.driverPaidPricePence ?? null,
        }));
        const driverOf = new Map(
          (found.docs as Job[]).map((job) => [job.id, relId(job.driver)]),
        );
        for (const job of jobs) {
          if (driverOf.get(job.id) !== driverId) {
            fail(req, "lines", `${job.reference} was not driven by this driver.`);
          }
          if (!isPayable(job)) {
            fail(
              req,
              "lines",
              job.driverPaymentId
                ? `${job.reference} is already paid.`
                : job.driverPricePence === null
                  ? `${job.reference} has no driver price yet.`
                  : `${job.reference} is not completed or PNS.`,
            );
          }
          if (new Date(job.pickupAt) > before) {
            fail(
              req,
              "lines",
              `${job.reference} is after the date this payment runs to.`,
            );
          }
        }

        jobs.sort((a, b) => a.pickupAt.localeCompare(b.pickupAt));
        const totals = payTotals(jobs);
        data.lines = jobs.map((job) => ({
          job: job.id,
          jobReference: job.reference,
          pickupAt: job.pickupAt,
          route: routeText(job).slice(0, 300),
          status: job.status,
          pricePence: job.driverPricePence,
          cashPence: cashHeldPence(job),
        }));
        data.earnedPence = totals.earnedPence;
        data.cashPence = totals.cashPence;
        data.amountPence = totals.netPence;
        data.recordedBy = req.user?.id ?? null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      // Each booking points at the payment that covers it; voiding frees them.
      async ({ doc, previousDoc, operation, req }) => {
        const lines = (doc.lines ?? []) as { job?: unknown; pricePence?: number }[];
        const voided = operation === "update" && doc.voidedAt && !previousDoc?.voidedAt;
        if (operation !== "create" && !voided) return doc;
        for (const line of lines) {
          const jobId = relId(line.job);
          if (!jobId) continue;
          await req.payload.update({
            collection: "jobs",
            id: jobId,
            data: voided
              ? { driverPayment: null, driverPaidPricePence: null }
              : { driverPayment: doc.id, driverPaidPricePence: line.pricePence ?? null },
            overrideAccess: true,
            req,
          });
        }
        return doc;
      },
      auditChanges<DriverPaymentDoc>({ label: (doc) => paymentReference(doc.id) }),
    ],
  },
  fields: [
    {
      name: "driver",
      type: "relationship",
      relationTo: "drivers",
      required: true,
      index: true,
    },
    {
      name: "upTo",
      type: "date",
      required: true,
      admin: { description: "Covers bookings picked up on or before this day." },
    },
    { name: "paidAt", type: "date", required: true, index: true },
    {
      name: "method",
      type: "select",
      required: true,
      options: Object.entries(PAYMENT_METHODS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    { name: "reference", type: "text", admin: { description: "The bank reference." } },
    { name: "notes", type: "textarea" },
    {
      name: "lines",
      type: "array",
      admin: { description: "The bookings paid for, as they were when paid." },
      fields: [
        { name: "job", type: "relationship", relationTo: "jobs", required: true },
        { name: "jobReference", type: "text" },
        { name: "pickupAt", type: "date" },
        { name: "route", type: "text" },
        { name: "status", type: "text" },
        { name: "pricePence", type: "number" },
        { name: "cashPence", type: "number" },
      ],
    },
    {
      name: "earnedPence",
      type: "number",
      admin: { description: "Driver prices, pence." },
    },
    {
      name: "cashPence",
      type: "number",
      admin: { description: "Cash the driver collected, taken off. Pence." },
    },
    {
      name: "amountPence",
      type: "number",
      admin: {
        description: "Paid: earned less cash. Below zero, the driver paid Cityline.",
      },
    },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
