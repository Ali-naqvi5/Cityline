"use server";

import { redirect } from "next/navigation";
import sharp from "sharp";

import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { isValidDay } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import { dayToIso, MAX_FILE_BYTES } from "@/admin/schemas/fleet";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/finance/driver-pay";

/**
 * Recording and voiding payments to drivers (Driver Pay). The collection
 * works out each payment's lines and totals from the bookings and refuses a
 * booking already paid; these actions check the person, the form, and save
 * as that person. A bank transfer can carry its receipt, a picture kept as a
 * private file and printed as the statement's last page (Cityline, 13 Oct 2026).
 */

const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const upload = formData.get("receipt");
  const receipt = upload instanceof File && upload.size > 0 ? upload : null;
  const jobIds = formData
    .getAll("job")
    .map((value) => Number(value))
    .filter((id) => Number.isInteger(id) && id > 0);

  const errors: Record<string, string> = {};
  if (!isValidDay(paidAt)) errors.paidAt = "Enter the date it was paid.";
  if (!(method in PAYMENT_METHODS)) errors.method = "Choose how it was paid.";
  if (jobIds.length === 0) errors.jobs = "Choose at least one booking to pay.";
  const receiptBytes = receipt ? Buffer.from(await receipt.arrayBuffer()) : null;
  if (receipt && receiptBytes) {
    if (method !== "bank_transfer") {
      errors.receipt = "A receipt goes with a bank transfer.";
    } else if (!RECEIPT_TYPES.includes(receipt.type)) {
      errors.receipt = "Upload a picture: JPG, PNG or WebP.";
    } else if (receipt.size > MAX_FILE_BYTES) {
      errors.receipt = "The picture is larger than 10 MB.";
    } else if (!(await readablePicture(receiptBytes))) {
      errors.receipt = "That picture could not be read. Try another.";
    }
  }
  if (!Number.isInteger(driverId) || driverId <= 0 || !isValidDay(upTo)) {
    return { errors, message: "That driver or date is not valid. Reload the page." };
  }
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  let paymentId: number;
  try {
    const file =
      receipt && receiptBytes
        ? await payload.create({
            collection: "private-files",
            data: { purpose: "receipt", uploadedBy: user.id },
            file: {
              data: receiptBytes,
              mimetype: receipt.type,
              name: receipt.name,
              size: receipt.size,
            },
            user,
            overrideAccess: false,
          })
        : null;
    const saved = await payload.create({
      collection: "driver-payments",
      data: {
        driver: driverId,
        upTo: dayToIso(upTo)!,
        paidAt: dayToIso(paidAt)!,
        method: method as PaymentMethod,
        reference: reference || null,
        notes: notes || null,
        receipt: file?.id ?? null,
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

/** Whether the upload really is a picture the statement can print. */
async function readablePicture(bytes: Buffer): Promise<boolean> {
  try {
    const { width, height } = await sharp(bytes).metadata();
    return Boolean(width && height);
  } catch {
    return false;
  }
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
