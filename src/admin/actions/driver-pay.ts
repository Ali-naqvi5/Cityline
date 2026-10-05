"use server";

import { redirect } from "next/navigation";

import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { isValidDay } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import { dayToIso } from "@/admin/schemas/fleet";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/finance/driver-pay";

/**
 * Recording and voiding payments to drivers (Driver Pay). The collection
 * works out each payment's lines and totals from the bookings and refuses a
 * booking already paid; these actions check the person, the form, and save
 * as that person.
 */

export async function recordDriverPaymentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("driverPay.manage");
  const driverId = Number(text(formData, "driverId"));
  const upTo = text(formData, "upTo");
  const paidAt = text(formData, "paidAt");
  const method = text(formData, "method");
  const reference = text(formData, "reference").slice(0, 100);
  const notes = text(formData, "notes").slice(0, 1000);
  const jobIds = formData
    .getAll("job")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);

  const errors: Record<string, string> = {};
  if (!isValidDay(paidAt)) errors.paidAt = "Enter the date it was paid.";
  if (!(method in PAYMENT_METHODS)) errors.method = "Choose how it was paid.";
  if (jobIds.length === 0) errors.jobs = "Choose at least one booking to pay.";
  if (!Number.isInteger(driverId) || driverId <= 0 || !isValidDay(upTo)) {
    return { errors, message: "That driver or date is not valid. Reload the page." };
  }
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  let paymentId: number;
  try {
    const saved = await payload.create({
      collection: "driver-payments",
      data: {
        driver: driverId,
        upTo: dayToIso(upTo)!,
        paidAt: dayToIso(paidAt)!,
        method: method as PaymentMethod,
        reference: reference || null,
        notes: notes || null,
        lines: jobIds.map((job) => ({ job })),
      },
      user,
      overrideAccess: false,
    });
    paymentId = saved.id;
  } catch (error) {
    return payloadErrors(error, "recording a driver payment");
  }
  redirect(`/admin/driver-pay/${driverId}?upTo=${upTo}&notice=paid&payment=${paymentId}`);
}

export async function voidDriverPaymentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("driverPay.manage");
  const id = Number(text(formData, "paymentId"));
  const driverId = Number(text(formData, "driverId"));
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) {
    return { errors: { reason: "Write why this payment is void." }, message: "" };
  }
  try {
    await payload.update({
      collection: "driver-payments",
      id,
      data: { voidReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    const state = payloadErrors(error, "voiding a driver payment");
    if (state.errors.voidReason) state.errors.reason = state.errors.voidReason;
    return state;
  }
  redirect(`/admin/driver-pay/${driverId}?notice=voided`);
}
