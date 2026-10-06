import type { CollectionConfig } from "payload";

import { allow } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import {
  isStripeRefundId,
  refundable,
  REFUND_METHODS,
  refundReference,
} from "@/domain/finance/customer-money";
import type { Booking, CustomerPayment, Job, Payment, Refund } from "@/payload-types";

import { auditChanges } from "./hooks/audit";
import { failOn, onlyChange } from "./hooks/partner-lines";

/**
 * Refunds (§14 `refunds`, PAY-02), recorded by hand (Cityline, 6 Oct 2026).
 *
 * The office makes every refund itself — in Stripe for a website payment, by
 * bank or otherwise for an office one — and never from the admin. It is then
 * recorded here, against the payment it gives money back from and the
 * bookings it is for, so takings and profit stay right. A booking is never
 * refunded more than was paid for it.
 *
 * Never edited or deleted: a mistake is voided, with a reason, and recorded
 * again. Owner and Accounts.
 */

export const Refunds: CollectionConfig = {
  slug: "refunds",
  admin: {
    defaultColumns: ["refundedAt", "amountPence", "method", "reason"],
    description: "Refunds made by the office, recorded by hand. Voided, never edited.",
  },
  access: {
    read: allow("refunds.view"),
    create: allow("refunds.record"),
    update: allow("refunds.record"), // voiding only
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (operation === "update") {
          const checked = onlyChange("refunds", [])({ data, originalDoc, req });
          // A void one gives its Stripe refund id back, to be recorded again.
          if (checked.voidedAt && !originalDoc?.voidedAt) checked.stripeRefundId = null;
          return checked;
        }

        const fail = failOn("refunds", req);
        const paymentId = relId(data.payment);
        const customerPaymentId = relId(data.customerPayment);
        if (!paymentId === !customerPaymentId) {
          fail("payment", "Choose the payment the refund comes from.");
        }
        if (!data.refundedAt) fail("refundedAt", "Enter the date of the refund.");
        const reason = String(data.reason ?? "").trim();
        if (!reason) fail("reason", "Write why the money went back.");

        // What each booking on the payment was paid, and refunds so far.
        const paid = new Map<number, { reference: string; pence: number }>();
        if (paymentId) {
          const payment = (await req.payload.findByID({
            collection: "payments",
            id: paymentId,
            depth: 1,
            disableErrors: true,
            overrideAccess: true,
            req,
          })) as Payment | null;
          const booking =
            payment?.booking && typeof payment.booking === "object"
              ? (payment.booking as Booking)
              : null;
          if (!payment || !booking) fail("payment", "That payment is not on record.");
          if (booking!.isTest) fail("payment", "That is a test booking.");
          const jobs = await req.payload.find({
            collection: "jobs",
            where: { booking: { equals: booking!.id } },
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
          });
          for (const job of jobs.docs as Job[]) {
            paid.set(job.id, {
              reference: job.reference,
              pence: job.customerPricePence ?? 0,
            });
          }
          data.method = "stripe";
        } else {
          const payment = (await req.payload.findByID({
            collection: "customer-payments",
            id: customerPaymentId!,
            depth: 0,
            disableErrors: true,
            overrideAccess: true,
            req,
          })) as CustomerPayment | null;
          if (!payment) fail("customerPayment", "That payment is not on record.");
          if (payment!.voidedAt) fail("customerPayment", "That payment is void.");
          for (const line of payment!.lines ?? []) {
            const jobId = relId(line.job);
            if (jobId) {
              paid.set(jobId, {
                reference: line.jobReference ?? `Booking ${jobId}`,
                pence: line.amountPence ?? 0,
              });
            }
          }
          // A card payment link is Stripe's too, so any way back will do.
          if (!(String(data.method) in REFUND_METHODS)) {
            fail("method", "Choose how the money went back.");
          }
        }

        const earlier = await req.payload.find({
          collection: "refunds",
          where: {
            and: [
              paymentId
                ? { payment: { equals: paymentId } }
                : { customerPayment: { equals: customerPaymentId } },
              { voidedAt: { exists: false } },
            ],
          },
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req,
        });
        const refunded = new Map<number, number>();
        for (const refund of earlier.docs as Refund[]) {
          for (const line of refund.lines ?? []) {
            const jobId = relId(line.job);
            if (jobId)
              refunded.set(jobId, (refunded.get(jobId) ?? 0) + (line.amountPence ?? 0));
          }
        }

        const lines: { job: number; jobReference: string; amountPence: number }[] = [];
        for (const line of (data.lines ?? []) as {
          job?: unknown;
          amountPence?: unknown;
        }[]) {
          const jobId = relId(line.job);
          const amount = Number(line.amountPence);
          const booking = jobId ? paid.get(jobId) : undefined;
          if (!jobId || !booking) fail("lines", "That booking is not on this payment.");
          if (!Number.isInteger(amount) || amount <= 0) {
            fail(
              "lines",
              `Enter an amount for ${booking!.reference}, more than nothing.`,
            );
          }
          if (lines.some((existing) => existing.job === jobId)) {
            fail("lines", `${booking!.reference} is in the refund twice.`);
          }
          const left = refundable(booking!.pence, refunded.get(jobId!) ?? 0);
          if (amount > left) {
            fail(
              "lines",
              `${booking!.reference} has only £${(left / 100).toFixed(2)} left to refund.`,
            );
          }
          lines.push({
            job: jobId!,
            jobReference: booking!.reference,
            amountPence: amount,
          });
        }
        if (lines.length === 0) fail("lines", "Enter the amount refunded.");

        const reference = String(data.reference ?? "")
          .trim()
          .slice(0, 100);
        data.reference = reference || null;
        data.stripeRefundId = isStripeRefundId(reference) ? reference : null;
        if (data.stripeRefundId) {
          const same = await req.payload.find({
            collection: "refunds",
            where: { stripeRefundId: { equals: data.stripeRefundId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            req,
          });
          if (same.docs[0]) {
            fail(
              "reference",
              `That Stripe refund is already recorded, as ${refundReference(same.docs[0].id)}.`,
            );
          }
        }
        data.reason = reason.slice(0, 1000);
        data.lines = lines;
        data.amountPence = lines.reduce((sum, line) => sum + line.amountPence, 0);
        data.createdByUser = req.user?.id ?? null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      auditChanges<{ id: number }>({ label: (doc) => refundReference(doc.id) }),
    ],
  },
  fields: [
    {
      // A website card payment, from Stripe…
      name: "payment",
      type: "relationship",
      relationTo: "payments",
      index: true,
    },
    {
      // …or an office booking's payment, recorded by hand.
      name: "customerPayment",
      type: "relationship",
      relationTo: "customer-payments",
      index: true,
    },
    { name: "refundedAt", type: "date", index: true },
    {
      name: "method",
      type: "select",
      options: Object.entries(REFUND_METHODS).map(([value, label]) => ({ value, label })),
    },
    {
      name: "reference",
      type: "text",
      admin: { description: "Stripe's refund id (re_…), or the bank's reference." },
    },
    {
      // Set from the reference when it is a Stripe refund id, so the same
      // refund cannot be recorded twice.
      name: "stripeRefundId",
      type: "text",
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: "amountPence", type: "number", required: true },
    { name: "reason", type: "textarea" },
    {
      name: "lines",
      type: "array",
      fields: [
        { name: "job", type: "relationship", relationTo: "jobs", required: true },
        { name: "jobReference", type: "text" },
        { name: "amountPence", type: "number" },
      ],
    },
    {
      name: "createdByUser",
      label: "Recorded by",
      type: "relationship",
      relationTo: "users",
    },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
