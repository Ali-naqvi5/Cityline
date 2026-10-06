"use server";

import { redirect } from "next/navigation";

import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { isValidDay } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import { dayToIso } from "@/admin/schemas/fleet";
import { relId } from "@/domain/dispatch/assignment";
import { RECEIPT_METHODS, type ReceiptMethod } from "@/domain/finance/supplier-money";
import type { Job } from "@/payload-types";

/**
 * Supplier Money's actions: money received, invoices made, late
 * cancellations decided, invoices marked sent, and voids. The collections
 * work the lines and totals out from the bookings; these check the person and
 * the form, and save as that person. Nothing here sends anything to a
 * partner — the office does that.
 */

const back = (supplierId: number, query: string) =>
  `/admin/supplier-money/${supplierId}?${query}`;

/** Money received, or an invoice — for the bookings ticked. */
export async function partnerMoneyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("supplierMoney.manage");
  const supplierId = Number(text(formData, "supplierId"));
  const upTo = text(formData, "upTo");
  const intent = text(formData, "intent") === "invoice" ? "invoice" : "receipt";
  const jobIds = formData
    .getAll("job")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return { errors: {}, message: "That partner is not valid. Reload the page." };
  }

  const errors: Record<string, string> = {};
  if (jobIds.length === 0) errors.jobs = "Choose at least one booking.";
  if (intent === "receipt") {
    if (!isValidDay(text(formData, "receivedAt")))
      errors.receivedAt = "Enter the date it arrived.";
    if (!(text(formData, "method") in RECEIPT_METHODS))
      errors.method = "Choose how it came.";
  } else if (!isValidDay(text(formData, "issuedAt"))) {
    errors.issuedAt = "Enter the invoice date.";
  }
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  let id: number;
  try {
    const lines = jobIds.map((job) => ({ job }));
    const notes = text(formData, "notes").slice(0, 1000) || null;
    if (intent === "receipt") {
      const saved = await payload.create({
        collection: "supplier-payments",
        data: {
          supplier: supplierId,
          receivedAt: dayToIso(text(formData, "receivedAt"))!,
          method: text(formData, "method") as ReceiptMethod,
          reference: text(formData, "reference").slice(0, 100) || null,
          notes,
          lines,
        },
        user,
        overrideAccess: false,
      });
      id = saved.id;
    } else {
      const saved = await payload.create({
        collection: "supplier-invoices",
        data: {
          supplier: supplierId,
          issuedAt: dayToIso(text(formData, "issuedAt"))!,
          notes,
          lines,
        },
        user,
        overrideAccess: false,
      });
      id = saved.id;
    }
  } catch (error) {
    const state = payloadErrors(error, `recording a partner ${intent}`);
    if (state.errors.lines) state.errors.jobs = state.errors.lines;
    return state;
  }
  redirect(
    back(
      supplierId,
      `${isValidDay(upTo) ? `upTo=${upTo}&` : ""}notice=${intent === "invoice" ? "invoiced" : "received"}&id=${id}`,
    ),
  );
}

/**
 * Whether the partner pays for a cancelled booking (a late cancellation).
 * Accounts may not edit bookings, so this one field is written with the
 * capability checked here; the booking must be the partner's, cancelled, and
 * not yet billed or paid.
 */
export async function decideCancellationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("supplierMoney.manage");
  const jobId = Number(text(formData, "jobId"));
  const supplierId = Number(text(formData, "supplierId"));
  const decision = text(formData, "decision");
  if (decision !== "charged" && decision !== "not_charged") {
    return { errors: {}, message: "Choose whether the partner pays." };
  }
  const job = (await payload.findByID({
    collection: "jobs",
    id: jobId,
    depth: 0,
    disableErrors: true,
    user,
    overrideAccess: false,
  })) as Job | null;
  if (
    !job ||
    job.source !== "supplier" ||
    relId(job.supplier) !== supplierId ||
    job.status !== "cancelled"
  ) {
    return {
      errors: {},
      message: "That booking is not a cancelled booking of this partner.",
    };
  }
  if (relId(job.supplierPayment) || relId(job.supplierInvoice)) {
    return {
      errors: {},
      message: "That booking is already on an invoice or paid for. Void that first.",
    };
  }
  await payload.update({
    collection: "jobs",
    id: jobId,
    data: { cancellationCharge: decision },
    user,
    overrideAccess: true,
  });
  redirect(back(supplierId, "notice=decided"));
}

export async function markInvoiceSentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("supplierMoney.manage");
  const id = Number(text(formData, "invoiceId"));
  const supplierId = Number(text(formData, "supplierId"));
  const sent = text(formData, "sent") === "1";
  try {
    await payload.update({
      collection: "supplier-invoices",
      id,
      data: { sentAt: sent ? new Date().toISOString() : null },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "marking an invoice sent");
  }
  redirect(back(supplierId, sent ? "notice=sent" : "notice=unsent"));
}

export async function voidPartnerRecordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("supplierMoney.manage");
  const id = Number(text(formData, "recordId"));
  const supplierId = Number(text(formData, "supplierId"));
  const collection =
    text(formData, "kind") === "invoice" ? "supplier-invoices" : "supplier-payments";
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) return { errors: { reason: "Write why this is void." }, message: "" };
  try {
    await payload.update({
      collection,
      id,
      data: { voidReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "voiding a partner record");
  }
  redirect(back(supplierId, "notice=voided"));
}
