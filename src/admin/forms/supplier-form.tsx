"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveSupplierAction } from "@/admin/actions/fleet";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  FormSection,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";
import { buttonClass } from "@/components/ops/primitives";

export interface SupplierFormValues {
  id?: number;
  name: string;
  commissionPercent: string;
  paymentTermsDays: string;
  contactName: string;
  email: string;
  phone: string;
  dashboardUrl: string;
  notes: string;
  active: boolean;
}

export function SupplierForm({
  values,
  cancelHref,
}: {
  values: SupplierFormValues;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveSupplierAction, EMPTY_FORM);
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection
        title="Supplier"
        description="A change to the commission applies to new jobs only; each job keeps the rate it was entered with."
      >
        <FormField id="name" label="Name" required error={e.name}>
          <input
            id="name"
            name="name"
            defaultValue={values.name}
            className={inputClass()}
            {...invalid(e.name, "name")}
          />
        </FormField>
        <FormField
          id="commissionPercent"
          label="Default commission (%)"
          required
          error={e.commissionPercent}
          hint="What the supplier keeps of the customer price."
        >
          <input
            id="commissionPercent"
            name="commissionPercent"
            inputMode="decimal"
            defaultValue={values.commissionPercent}
            placeholder="18"
            className={inputClass("tabular-nums")}
            {...invalid(e.commissionPercent, "commissionPercent")}
          />
        </FormField>
        <FormField
          id="paymentTermsDays"
          label="Payment terms (days)"
          error={e.paymentTermsDays}
          hint="How long after the trip they normally pay."
        >
          <input
            id="paymentTermsDays"
            name="paymentTermsDays"
            inputMode="numeric"
            defaultValue={values.paymentTermsDays}
            className={inputClass("tabular-nums")}
            {...invalid(e.paymentTermsDays, "paymentTermsDays")}
          />
        </FormField>
        <FormField
          id="dashboardUrl"
          label="Supplier dashboard link"
          error={e.dashboardUrl}
        >
          <input
            id="dashboardUrl"
            name="dashboardUrl"
            type="url"
            defaultValue={values.dashboardUrl}
            placeholder="https://"
            className={inputClass()}
            {...invalid(e.dashboardUrl, "dashboardUrl")}
          />
        </FormField>
      </FormSection>

      <FormSection title="Contact">
        <FormField id="contactName" label="Contact name" error={e.contactName}>
          <input
            id="contactName"
            name="contactName"
            defaultValue={values.contactName}
            className={inputClass()}
          />
        </FormField>
        <FormField id="email" label="Email" error={e.email}>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={values.email}
            className={inputClass()}
            {...invalid(e.email, "email")}
          />
        </FormField>
        <FormField id="phone" label="Phone" error={e.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            className={inputClass("tabular-nums")}
          />
        </FormField>
        <div className="flex items-end">
          <label
            htmlFor="active"
            className="text-ink-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={values.active}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            Active — new jobs can be entered for this supplier
          </label>
        </div>
      </FormSection>

      <FormSection title="Notes">
        <FormField id="notes" label="Notes" wide error={e.notes}>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={values.notes}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </FormSection>

      <FormMessage state={state} />
      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-5">
        <SubmitButton pending={pending}>
          {values.id ? "Save changes" : "Add supplier"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
