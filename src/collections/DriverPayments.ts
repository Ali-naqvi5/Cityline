import { ValidationError, type CollectionConfig, type PayloadRequest } from "payload";

import { allow, hiddenUnlessOwner } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import {
  cashHeldPence,
  isPayable,
  PAYMENT_METHODS,
  paymentPeriodStart,
  paymentReference,
  payTotals,
  routeText,
  type PayJob,
} from "@/domain/finance/driver-pay";
import { penaltyReference } from "@/domain/finance/penalties";
import type { JobStatus } from "@/domain/jobs/labels";
import { londonDateAndTime, londonToUtc } from "@/lib/time";
import type { Job, PartnerPenalty } from "@/payload-types";

import { auditChanges } from "./hooks/audit";
import { linkPenalties } from "./hooks/partner-lines";

/**
 * Payments to drivers (Driver Pay, approved by Cityline, 6 Oct 2026).
 *
 * Each one covers a set of bookings, picked up to a chosen date, and a period
 * from the day after the driver's last payment (Cityline, 14 Oct 2026). The server
 * works out the lines and totals from the bookings themselves — the driver
 * price written on each, less any cash the driver collected — so nothing
 * typed can disagree with the bookings, and a booking already paid cannot be
 * paid again. Each covered booking points back at its payment. The driver's
 * share of partner penalties comes off too, each once (Cityline, 16 Oct
 * 2026); a payment may cover only such a share, which the driver then owes.
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
    hidden: hiddenUnlessOwner,
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

        // A new payment: its lines and totals come from the bookings. It is
        // to a driver or to a subcontracting operator, never both.
        const driverId = relId(data.driver);
        const operatorId = relId(data.operator);
        if (!driverId && !operatorId) fail(req, "driver", "Choose the driver.");
        if (driverId && operatorId) {
          fail(req, "operator", "A payment is to a driver or an operator, not both.");
        }
        const payee = driverId
          ? ({ field: "driver", id: driverId, who: "driven by this driver" } as const)
          : ({
              field: "operator",
              id: operatorId!,
              who: "done by this operator",
            } as const);
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
        const penaltyIds = [
          ...new Set(
            ((data.penalties ?? []) as { penalty?: unknown }[])
              .map((line) => relId(line.penalty))
              .filter((id): id is number => id !== null),
          ),
        ];
        if (ids.length === 0 && penaltyIds.length === 0) {
          fail(req, "lines", "Choose at least one booking to pay.");
        }

        const found = ids.length
          ? await req.payload.find({
              collection: "jobs",
              where: { id: { in: ids } },
              pagination: false,
              depth: 0,
              overrideAccess: true,
              req,
            })
          : { docs: [] };
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
        const payeeOf = new Map(
          (found.docs as Job[]).map((job) => [job.id, relId(job[payee.field])]),
        );
        for (const job of jobs) {
          if (payeeOf.get(job.id) !== payee.id) {
            fail(req, "lines", `${job.reference} was not ${payee.who}.`);
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

        // The driver's share of partner penalties, taken off once each.
        const penalties = penaltyIds.length
          ? ((
              await req.payload.find({
                collection: "partner-penalties",
                where: { id: { in: penaltyIds } },
                sort: "penalisedAt",
                pagination: false,
                depth: 0,
                overrideAccess: true,
                req,
              })
            ).docs as PartnerPenalty[])
          : [];
        if (penalties.length !== penaltyIds.length) {
          fail(req, "penalties", "One of those penalties is not on record.");
        }
        for (const penalty of penalties) {
          const reference = penaltyReference(penalty.id);
          if (penalty.voidedAt) fail(req, "penalties", `${reference} is void.`);
          if (!penalty.driverSharePence) {
            fail(req, "penalties", `Nothing of ${reference} is passed to the driver.`);
          }
          if (relId(penalty[payee.field]) !== payee.id) {
            fail(req, "penalties", `${reference} is not taken from this ${payee.field}.`);
          }
          if (relId(penalty.driverPayment)) {
            fail(req, "penalties", `${reference} was already taken off a payment.`);
          }
        }

        // The period it covers: from the day after the driver's (or
        // operator's) last payment, not voided, to the day this one runs up
        // to. Kept with the payment, so a statement already sent never changes.
        const londonDay = (value: string) => londonDateAndTime(new Date(value)).date;
        const upToDay = londonDay(String(data.upTo));
        // A payment of penalties alone covers no bookings: it starts on its day.
        const firstBooking = jobs[0] ? londonDay(jobs[0].pickupAt) : upToDay;
        const previous = await req.payload.find({
          collection: "driver-payments",
          where: {
            and: [
              { [payee.field]: { equals: payee.id } },
              { voidedAt: { exists: false } },
              { upTo: { less_than: londonToUtc(upToDay, "00:00").toISOString() } },
            ],
          },
          sort: "-upTo",
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        });
        const previousUpTo = previous.docs[0]?.upTo;
        data.periodFrom = londonToUtc(
          paymentPeriodStart({
            upTo: upToDay,
            previousUpTo: previousUpTo ? londonDay(previousUpTo) : null,
            firstBooking,
          }),
          "12:00",
        ).toISOString();

        const penaltyLines = penalties.map((penalty) => ({
          penalty: penalty.id,
          penaltyReference: penaltyReference(penalty.id),
          jobReference: penalty.jobReference ?? "",
          penalisedAt: penalty.penalisedAt,
          reason: (penalty.reason ?? "").slice(0, 300),
          amountPence: penalty.driverSharePence ?? 0,
        }));
        const totals = payTotals(
          jobs,
          penaltyLines.map((line) => ({ driverSharePence: line.amountPence })),
        );
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
        data.penalties = penaltyLines;
        data.penaltiesPence = totals.penaltiesPence;
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
        await linkPenalties(req, "driverPayment", doc, previousDoc, operation);
        return doc;
      },
      auditChanges<DriverPaymentDoc>({ label: (doc) => paymentReference(doc.id) }),
    ],
  },
  fields: [
    {
      // Who was paid: a driver, or a subcontracting operator (Cityline, 15
      // Oct 2026) — one of the two.
      name: "driver",
      type: "relationship",
      relationTo: "drivers",
      index: true,
    },
    {
      name: "operator",
      type: "relationship",
      relationTo: "operators",
      index: true,
    },
    {
      name: "periodFrom",
      type: "date",
      admin: {
        description:
          "The first day this payment covers: the day after the driver's last payment, or its first booking's day. Worked out when it is recorded.",
      },
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
    {
      name: "receipt",
      type: "upload",
      relationTo: "private-files",
      admin: {
        description:
          "The bank transfer receipt, if one was added: a picture, printed on its own as the statement's last page.",
      },
    },
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
      name: "penalties",
      type: "array",
      admin: {
        description:
          "The driver's share of partner penalties taken off, as it was when paid.",
      },
      fields: [
        {
          name: "penalty",
          type: "relationship",
          relationTo: "partner-penalties",
          required: true,
        },
        { name: "penaltyReference", type: "text" },
        { name: "jobReference", type: "text" },
        { name: "penalisedAt", type: "date" },
        { name: "reason", type: "text" },
        { name: "amountPence", type: "number" },
      ],
    },
    {
      name: "penaltiesPence",
      type: "number",
      admin: {
        description: "The driver's share of partner penalties, taken off. Pence.",
      },
    },
    {
      name: "amountPence",
      type: "number",
      admin: {
        description:
          "Paid: earned less cash and penalties. Below zero, the driver paid Cityline.",
      },
    },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
