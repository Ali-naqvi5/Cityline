"use server";

import { redirect } from "next/navigation";

import { feesMissing, paymentForReference } from "@/admin/data/payments";
import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { isValidDay } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import { dayToIso } from "@/admin/schemas/fleet";
import {
  CUSTOMER_PAYMENT_METHODS,
  REFUND_METHODS,
  type CustomerPaymentMethod,
  type RefundMethod,
} from "@/domain/finance/customer-money";
import { parsePounds } from "@/domain/money";
import { recordCardFee } from "@/domain/payments/card-fee";

/**
 * Payments' and Refunds' actions: office bookings marked paid, refunds
 * recorded, either voided, and Stripe's card fees fetched. Nothing here moves
 * money — refunds are made by the office in Stripe or by bank — and the
 * collections work lines and totals out from the bookings; these check the
 * person and the form, and save as that person.
 */

/** A void's message belongs on the dialog, not on a field it does not have. */
const forDialog = (state: FormState): FormState => ({
  errors: {},
  message:
    state.errors.voidReason ??
    state.errors.reason ??
    state.message ??
    "That could not be saved.",
});

/** An office booking's money, for the bookings ticked. */
export async function recordCustomerPaymentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("payments.record");
  const jobIds = formData
    .getAll("job")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);
  const paidAt = text(formData, "paidAt");
  const method = text(formData, "method");
  const feeText = text(formData, "fee");
  const fee = feeText ? parsePounds(feeText) : null;

  const errors: Record<string, string> = {};
  if (jobIds.length === 0) errors.jobs = "Choose at least one booking.";
  if (!isValidDay(paidAt)) errors.paidAt = "Enter the date it was paid.";
  if (!(method in CUSTOMER_PAYMENT_METHODS)) errors.method = "Choose how it was paid.";
  if (feeText && (fee === null || fee < 0)) {
    errors.fee = "Enter the card fee in pounds, such as 1.20, or leave it empty.";
  }
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  let id: number;
  try {
    const saved = await payload.create({
      collection: "customer-payments",
      data: {
        paidAt: dayToIso(paidAt)!,
        method: method as CustomerPaymentMethod,
        reference: text(formData, "reference").slice(0, 100) || null,
        paidBy: text(formData, "paidBy").slice(0, 200) || null,
        feePence: fee || null,
        notes: text(formData, "notes").slice(0, 1000) || null,
        lines: jobIds.map((job) => ({ job })),
      },
      user,
      overrideAccess: false,
    });
    id = saved.id;
  } catch (error) {
    const state = payloadErrors(error, "recording a customer's payment");
    if (state.errors.lines) state.errors.jobs = state.errors.lines;
    if (state.errors.feePence) state.errors.fee = state.errors.feePence;
    return state;
  }
  redirect(`/admin/payments?notice=paid&id=${id}`);
}

export async function voidCustomerPaymentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("payments.record");
  const id = Number(text(formData, "paymentId"));
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) return { errors: { reason: "Write why this is void." }, message: "" };
  try {
    await payload.update({
      collection: "customer-payments",
      id,
      data: { voidReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return forDialog(payloadErrors(error, "voiding a customer's payment"));
  }
  redirect(`/admin/payments/office/${id}?notice=voided`);
}

/** A refund the office has made, recorded against the payment it came from. */
export async function recordRefundAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("refunds.record");
  const kind = text(formData, "kind") === "office" ? "office" : "website";
  const paymentId = Number(text(formData, "paymentId"));
  const refundedAt = text(formData, "refundedAt");
  const method = kind === "website" ? "stripe" : text(formData, "method");
  const reason = text(formData, "reason");
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return { errors: {}, message: "That payment is not valid. Reload the page." };
  }

  const errors: Record<string, string> = {};
  const lines: { job: number; amountPence: number }[] = [];
  for (const job of formData.getAll("job").map(Number)) {
    if (!Number.isInteger(job) || job <= 0) continue;
    const typed = text(formData, `amount-${job}`);
    if (!typed) continue;
    const amount = parsePounds(typed);
    if (amount === null || amount <= 0) {
      errors[`amount-${job}`] = "Enter the amount in pounds, such as 25.00.";
    } else {
      lines.push({ job, amountPence: amount });
    }
  }
  if (lines.length === 0 && !Object.keys(errors).length) {
    errors.amounts = "Enter the amount refunded.";
  }
  if (!isValidDay(refundedAt)) errors.refundedAt = "Enter the date of the refund.";
  if (!(method in REFUND_METHODS)) errors.method = "Choose how the money went back.";
  if (!reason) errors.reason = "Write why the money went back.";
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  try {
    await payload.create({
      collection: "refunds",
      data: {
        ...(kind === "website" ? { payment: paymentId } : { customerPayment: paymentId }),
        refundedAt: dayToIso(refundedAt)!,
        method: method as RefundMethod,
        reference: text(formData, "reference").slice(0, 100) || null,
        reason: reason.slice(0, 1000),
        lines,
        amountPence: lines.reduce((sum, line) => sum + line.amountPence, 0),
      },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    const state = payloadErrors(error, "recording a refund");
    if (state.errors.lines) state.errors.amounts = state.errors.lines;
    return state;
  }
  redirect(`/admin/payments/${kind}/${paymentId}?notice=refunded`);
}

/** Back to where the void was asked for: a payment's page, or Refunds. */
function backTo(value: string): string {
  return /^\/admin\/(payments\/(website|office)\/\d+|refunds)$/.test(value)
    ? value
    : "/admin/refunds";
}

export async function voidRefundAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("refunds.record");
  const id = Number(text(formData, "refundId"));
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) return { errors: { reason: "Write why this is void." }, message: "" };
  try {
    await payload.update({
      collection: "refunds",
      id,
      data: { voidReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return forDialog(payloadErrors(error, "voiding a refund"));
  }
  redirect(`${backTo(text(formData, "back"))}?notice=refund-voided`);
}

/** Find the payment behind a booking, to record a refund against it. */
export async function findPaymentForRefundAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("refunds.record");
  const found = await paymentForReference(payload, user, text(formData, "reference"));
  if ("message" in found) return { errors: { reference: found.message }, message: "" };
  redirect(`${found.href}#record-refund`);
}

/**
 * Stripe's fee for each website payment that has none yet. Stripe works it
 * out just after the payment; this catches any the webhook missed.
 */
export async function fetchCardFeesAction(): Promise<FormState> {
  const { payload, user } = await staffForAction("payments.record");
  const missing = await feesMissing(payload, user);
  let got = 0;
  let waiting = 0;
  let failed = 0;
  for (const payment of missing) {
    try {
      const result = await recordCardFee(payment.stripePaymentIntentId);
      if (result === "recorded" || result === "already") got += 1;
      else waiting += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[payments] card fee for ${payment.stripePaymentIntentId} could not be read.`,
        error,
      );
    }
  }
  if (failed && !got) {
    return {
      errors: {},
      message:
        "Stripe did not answer, or refused. Try again later; if it keeps happening, check the Stripe key may read payments and balance transactions.",
    };
  }
  redirect(`/admin/payments?notice=fees&got=${got}&waiting=${waiting + failed}`);
}
