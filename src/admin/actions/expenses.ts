"use server";

import { redirect } from "next/navigation";

import { EXPENSE_METHODS, type ExpenseMethod } from "@/collections/Expenses";
import { payloadErrors, text } from "@/admin/form-errors";
import type { FormState } from "@/admin/form-state";
import { isValidDay } from "@/admin/format";
import { staffForAction } from "@/admin/guard";
import { dayToIso, fileProblem } from "@/admin/schemas/fleet";
import { parsePounds } from "@/domain/money";

/**
 * Entering and voiding Cityline's own expenses (Controller and Accounts).
 * The receipt, if any, is kept as a private file.
 */
export async function addExpenseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("expenses.manage");
  const spentAt = text(formData, "spentAt");
  const description = text(formData, "description");
  const amount = parsePounds(text(formData, "amount"));
  const method = text(formData, "method");
  const upload = formData.get("receipt");
  const file = upload instanceof File && upload.size > 0 ? upload : null;

  const errors: Record<string, string> = {};
  if (!isValidDay(spentAt)) errors.spentAt = "Enter the date it was spent.";
  if (!description) errors.description = "Write what it was for.";
  else if (description.length > 200) errors.description = "Keep it under 200 characters.";
  if (amount === null || amount <= 0) {
    errors.amount = "Enter the amount in pounds, such as 49.99.";
  }
  if (method && !(method in EXPENSE_METHODS)) errors.method = "Choose how it was paid.";
  const problem = fileProblem(file);
  if (problem) errors.receipt = problem;
  if (Object.keys(errors).length) {
    return { errors, message: "Please check the highlighted fields." };
  }

  let id: number;
  try {
    const receipt = file
      ? await payload.create({
          collection: "private-files",
          data: { purpose: "receipt", uploadedBy: user.id },
          file: {
            data: Buffer.from(await file.arrayBuffer()),
            mimetype: file.type,
            name: file.name,
            size: file.size,
          },
          user,
          overrideAccess: false,
        })
      : null;
    const saved = await payload.create({
      collection: "expenses",
      data: {
        spentAt: dayToIso(spentAt)!,
        description,
        amountPence: amount!,
        paidTo: text(formData, "paidTo").slice(0, 120) || null,
        method: (method || null) as ExpenseMethod | null,
        receipt: receipt?.id ?? null,
        notes: text(formData, "notes").slice(0, 1000) || null,
      },
      user,
      overrideAccess: false,
    });
    id = saved.id;
  } catch (error) {
    return payloadErrors(error, "adding an expense");
  }
  redirect(`/admin/expenses?notice=added&id=${id}`);
}

export async function voidExpenseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { payload, user } = await staffForAction("expenses.manage");
  const id = Number(text(formData, "expenseId"));
  const reason = text(formData, "reason").slice(0, 1000);
  if (!reason) return { errors: { reason: "Write why this is void." }, message: "" };
  try {
    await payload.update({
      collection: "expenses",
      id,
      data: { voidReason: reason },
      user,
      overrideAccess: false,
    });
  } catch (error) {
    return payloadErrors(error, "voiding an expense");
  }
  redirect("/admin/expenses?notice=voided");
}
