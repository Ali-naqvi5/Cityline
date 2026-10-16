"use server";

import { redirect } from "next/navigation";

import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { isValidDay } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import { dayToIso } from "@/admin/schemas/fleet";
import { driverShareProblem, penaltyAmountProblem } from "@/domain/finance/penalties";
import { parsePounds } from "@/domain/money";
import type { Job } from "@/payload-types";

/**
 * Partner penalties (Cityline, 16 Oct 2026), recorded by hand from a partner
 * booking's page or the partner's Supplier Money page, and voided with a
 * reason. The collection checks the booking and works out who a driver's
 * share is taken from; these check the person and the form, and save as that
 * person. Nothing ever records a penalty by itself.
 */

/** Back to where the form was: the booking, or the partner's money. */
function backHref(formData: FormData, notice: string): string {
  const supplierId = Number(text(formData, "supplierId"));
  return text(formData, "from") === "partner" && supplierId > 0
    ? `/admin/supplier-money/${supplierId}?notice=${notice}`
    : `/admin/jobs/${Number(text(formData, "jobId"))}?notice=${notice}`;
}

/** The collection's field names, as the form's. */
const FIELD_NAMES: Record<string, string> = {
  amountPence: "amount",
  driverSharePence: "driverShare",
  penalisedAt: "penalisedAt",
  reason: "reason",
  job: "booking",
};

export async function recordPenaltyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("supplierMoney.manage");
  const fromPartner = text(formData, "from") === "partner";
  const supplierId = Number(text(formData, "supplierId"));
  const errors: Record<string, string> = {};

  // From the partner's page, the booking is found by its reference: ours
  // (J-…) or the partner's own.
  let jobId = Number(text(formData, "jobId"));
  if (fromPartner) {
    const reference = text(formData, "booking");
    const found = reference
      ? await payload.find({
          collection: "jobs",
          where: {
            and: [
              { source: { equals: "supplier" } },
              { supplier: { equals: supplierId } },
              {
                or: [
                  { reference: { equals: reference.toUpperCase() } },
                  { supplierReference: { equals: reference } },
                ],
              },
            ],
          },
          limit: 1,
          depth: 0,
          user,
          overrideAccess: false,
        })
      : { docs: [] as Job[] };
    jobId = found.docs[0]?.id ?? 0;
    if (!jobId) {
      errors.booking = reference
        ? "No booking of this partner has that reference."
        : "Enter the booking's reference, ours or theirs.";
    }
  }

  const amount = parsePounds(text(formData, "amount"));
  const amountProblem = penaltyAmountProblem(amount);
  if (amountProblem) errors.amount = amountProblem;
  const shareText = text(formData, "driverShare");
  const share = shareText ? parsePounds(shareText) : 0;
  if (!amountProblem) {
    const shareProblem = driverShareProblem(amount!, share);
    if (shareProblem) errors.driverShare = shareProblem;
  }
  const penalisedAt = text(formData, "penalisedAt");
  if (!isValidDay(penalisedAt)) errors.penalisedAt = "Enter the date of the penalty.";
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) errors.reason = "Write what the partner fined Cityline for.";
  if (!jobId && !fromPartner) {
    return { errors, message: "That booking is not valid. Reload the page." };
  }
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  try {
    await payload.create({
      collection: "partner-penalties",
      data: {
        job: jobId,
        penalisedAt: dayToIso(penalisedAt)!,
        amountPence: amount!,
        driverSharePence: share ?? 0,
        reason,
        partnerReference: text(formData, "partnerReference").slice(0, 100) || null,
      },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    const state = payloadErrors(error, "recording a partner penalty");
    for (const [field, name] of Object.entries(FIELD_NAMES)) {
      if (state.errors[field] && field !== name) state.errors[name] = state.errors[field];
    }
    return state;
  }
  redirect(backHref(formData, "penalty"));
}

export async function voidPenaltyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("supplierMoney.manage");
  const id = Number(text(formData, "penaltyId"));
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) return { errors: { reason: "Write why this is void." }, message: "" };
  try {
    await payload.update({
      collection: "partner-penalties",
      id,
      data: { voidReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    const state = payloadErrors(error, "voiding a partner penalty");
    // Shown in the dialog beside the choice: "Void PR-… first", say.
    if (state.errors.voidReason) {
      return { errors: { reason: state.errors.voidReason }, message: "" };
    }
    return state;
  }
  redirect(backHref(formData, "penalty-voided"));
}
