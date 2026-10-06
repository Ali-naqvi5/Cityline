"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";

import { addExpenseAction } from "@/admin/actions/expenses";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";

const METHODS = [
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["cash", "Cash"],
  ["other", "Other"],
] as const;

/** One of Cityline's own expenses, entered by hand. */
export function ExpenseForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addExpenseAction, EMPTY_FORM);
  const e = state.errors;
  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="spentAt" label="Date" required error={e.spentAt}>
          <input
            id="spentAt"
            name="spentAt"
            type="date"
            defaultValue={today}
            className={inputClass()}
            {...invalid(e.spentAt, "spentAt")}
          />
        </FormField>
        <FormField id="description" label="What for" required error={e.description} wide>
          <input
            id="description"
            name="description"
            maxLength={200}
            className={inputClass()}
            {...invalid(e.description, "description")}
          />
        </FormField>
        <FormField id="amount" label="Amount" required error={e.amount}>
          <div className="relative">
            <span
              aria-hidden
              className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
            >
              £
            </span>
            <input
              id="amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className={inputClass("pl-7 tabular-nums")}
              {...invalid(e.amount, "amount")}
            />
          </div>
        </FormField>
        <FormField id="paidTo" label="Paid to" hint="Optional.">
          <input id="paidTo" name="paidTo" maxLength={120} className={inputClass()} />
        </FormField>
        <FormField id="method" label="How" error={e.method}>
          <select id="method" name="method" defaultValue="" className={inputClass()}>
            <option value="">Not recorded</option>
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="receipt"
          label="Receipt"
          hint="Optional. PDF, JPG, PNG or WebP."
          error={e.receipt}
          wide
        >
          <input
            id="receipt"
            name="receipt"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="text-ink-2 file:border-line file:bg-surface file:text-ink hover:file:bg-sunken w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
            {...invalid(e.receipt, "receipt")}
          />
        </FormField>
        <FormField id="notes" label="Notes" hint="Optional." wide>
          <textarea
            id="notes"
            name="notes"
            rows={1}
            maxLength={1000}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Adding…">
          <Plus aria-hidden className="h-4 w-4" />
          Add expense
        </SubmitButton>
      </div>
    </form>
  );
}
