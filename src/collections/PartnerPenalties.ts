import type { CollectionConfig, FieldAccess } from "payload";

import { allow, allowAny, hiddenUnlessOwner } from "@/access/staff";
import { relId } from "@/domain/dispatch/assignment";
import { paymentReference } from "@/domain/finance/driver-pay";
import {
  driverShareProblem,
  penaltyAmountProblem,
  penaltyReference,
} from "@/domain/finance/penalties";
import { invoiceNumber, receiptReference } from "@/domain/finance/supplier-money";
import type { Job } from "@/payload-types";

import { auditChanges } from "./hooks/audit";
import { failOn, onlyChange } from "./hooks/partner-lines";

/**
 * Partner penalties (Cityline, 16 Oct 2026): a partner fines Cityline for one
 * of its bookings and takes the fine off what it pays. Recorded by hand, by
 * the Owner or Accounts — nothing in the system ever makes one.
 *
 * The partner's payment (and any invoice) it is taken from points it here,
 * through the payment's own hook. Part or all of it may be passed to the
 * booking's driver or subcontracting operator when it is recorded; that part
 * comes off their next Driver Pay. The rest comes off Cityline's profit.
 *
 * Never edited or deleted: a mistake is voided, with a reason, and recorded
 * again — and only while no payment or invoice holds it.
 */

/** Written by the payments' hooks only, never by staff or the API. */
const hookOnly: FieldAccess = () => false;

const DONE = new Set(["completed", "no_show", "cancelled"]);

export const PartnerPenalties: CollectionConfig = {
  slug: "partner-penalties",
  admin: {
    hidden: hiddenUnlessOwner,
    defaultColumns: ["penalisedAt", "jobReference", "amountPence", "reason"],
    description:
      "Penalties partners took off what they pay, recorded by hand. Voided, never edited.",
  },
  access: {
    read: allowAny("supplierMoney.view", "driverPay.view"),
    create: allow("supplierMoney.manage"),
    update: allow("supplierMoney.manage"), // voiding only; the links are the hooks'
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const fail = failOn("partner-penalties", req);
        if (operation === "update") {
          const original = (originalDoc ?? {}) as Record<string, unknown>;
          if (data.voidReason && !original.voidReason) {
            // Held by a payment or invoice: that comes first.
            const receipt = relId(original.supplierPayment);
            const invoice = relId(original.supplierInvoice);
            const driverPayment = relId(original.driverPayment);
            if (receipt) {
              fail(
                "voidReason",
                `It was taken off ${receiptReference(receipt)}. Void that first.`,
              );
            }
            if (invoice) {
              fail("voidReason", `It is on ${invoiceNumber(invoice)}. Void that first.`);
            }
            if (driverPayment) {
              fail(
                "voidReason",
                `It came off the driver's ${paymentReference(driverPayment)}. Void that first.`,
              );
            }
          }
          return onlyChange("partner-penalties", [
            "supplierPayment",
            "supplierInvoice",
            "driverPayment",
          ])({ data, originalDoc, req });
        }

        const jobId = relId(data.job);
        const job = jobId
          ? ((await req.payload.findByID({
              collection: "jobs",
              id: jobId,
              depth: 0,
              disableErrors: true,
              overrideAccess: true,
              req,
            })) as Job | null)
          : null;
        if (!job) fail("job", "Choose the booking the partner fined.");
        if (job!.source !== "supplier" || !relId(job!.supplier)) {
          fail("job", `${job!.reference} is not a partner's booking.`);
        }
        if (job!.isTest) fail("job", `${job!.reference} is a test booking.`);
        if (!DONE.has(job!.status)) {
          fail(
            "job",
            `${job!.reference} is not completed, PNS or cancelled yet. Move it on first.`,
          );
        }
        if (!data.penalisedAt) fail("penalisedAt", "Enter the date of the penalty.");

        const amount = Number.isInteger(data.amountPence) ? data.amountPence : null;
        const amountProblem = penaltyAmountProblem(amount);
        if (amountProblem) fail("amountPence", amountProblem);
        const share =
          data.driverSharePence === null || data.driverSharePence === undefined
            ? 0
            : Number.isInteger(data.driverSharePence)
              ? data.driverSharePence
              : null;
        const shareProblem = driverShareProblem(amount!, share);
        if (shareProblem) fail("driverSharePence", shareProblem);

        const reason = String(data.reason ?? "").trim();
        if (!reason) fail("reason", "Write what the partner fined Cityline for.");

        // The part passed on is taken from whoever did the booking.
        const driverId = relId(job!.driver);
        const operatorId = relId(job!.operator);
        if (share! > 0 && !driverId && !operatorId) {
          fail(
            "driverSharePence",
            `${job!.reference} has no driver or operator to take it from.`,
          );
        }

        data.supplier = relId(job!.supplier);
        data.jobReference = job!.reference;
        data.supplierReference = job!.supplierReference ?? null;
        data.reason = reason.slice(0, 1000);
        data.partnerReference =
          String(data.partnerReference ?? "")
            .trim()
            .slice(0, 100) || null;
        data.amountPence = amount;
        data.driverSharePence = share;
        data.driver = share! > 0 ? driverId : null;
        data.operator = share! > 0 && !driverId ? operatorId : null;
        data.supplierPayment = null;
        data.supplierInvoice = null;
        data.driverPayment = null;
        data.recordedBy = req.user?.id ?? null;
        data.voidedAt = null;
        data.voidReason = null;
        data.voidedBy = null;
        return data;
      },
    ],
    afterChange: [
      auditChanges<{ id: number }>({ label: (doc) => penaltyReference(doc.id) }),
    ],
  },
  fields: [
    {
      // From the booking: the partner who sent it.
      name: "supplier",
      type: "relationship",
      relationTo: "suppliers",
      index: true,
    },
    {
      name: "job",
      type: "relationship",
      relationTo: "jobs",
      required: true,
      index: true,
    },
    { name: "jobReference", type: "text" },
    { name: "supplierReference", type: "text" },
    { name: "penalisedAt", type: "date", required: true, index: true },
    { name: "amountPence", type: "number", required: true },
    { name: "reason", type: "textarea", required: true },
    {
      name: "partnerReference",
      type: "text",
      admin: { description: "The partner's own reference for the penalty." },
    },
    {
      name: "driverSharePence",
      type: "number",
      defaultValue: 0,
      admin: {
        description:
          "The part passed to the booking's driver or operator, taken off their next Driver Pay. Pence.",
      },
    },
    {
      // Who that part is taken from: the booking's driver, or its operator.
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
      // The partner's payment it was taken off.
      name: "supplierPayment",
      access: { create: hookOnly, update: hookOnly },
      type: "relationship",
      relationTo: "supplier-payments",
      index: true,
      admin: { readOnly: true },
    },
    {
      // The invoice it is shown on, as a minus line.
      name: "supplierInvoice",
      access: { create: hookOnly, update: hookOnly },
      type: "relationship",
      relationTo: "supplier-invoices",
      index: true,
      admin: { readOnly: true },
    },
    {
      // The driver payment the driver's part came off.
      name: "driverPayment",
      access: { create: hookOnly, update: hookOnly },
      type: "relationship",
      relationTo: "driver-payments",
      index: true,
      admin: { readOnly: true },
    },
    { name: "recordedBy", type: "relationship", relationTo: "users" },
    { name: "voidedAt", type: "date" },
    { name: "voidReason", type: "textarea" },
    { name: "voidedBy", type: "relationship", relationTo: "users" },
  ],
};
