"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveCustomerAction } from "@/admin/actions/customers";
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

export interface CustomerFormValues {
  id?: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export function CustomerForm({
  values,
  cancelHref,
}: {
  values: CustomerFormValues;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveCustomerAction, EMPTY_FORM);
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection
        title="Contact"
        description="Office bookings with this phone and name, or this email, join this customer's history."
      >
        <FormField id="name" label="Name" required error={e.name}>
          <input
            id="name"
            name="name"
            defaultValue={values.name}
            autoComplete="off"
            className={inputClass()}
            {...invalid(e.name, "name")}
          />
        </FormField>
        <FormField id="phone" label="Phone" required error={e.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            autoComplete="off"
            className={inputClass("tabular-nums")}
            {...invalid(e.phone, "phone")}
          />
        </FormField>
        <FormField
          id="email"
          label="Email"
          error={e.email}
          hint="Leave empty if they only book by phone."
        >
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={values.email}
            autoComplete="off"
            className={inputClass()}
            {...invalid(e.email, "email")}
          />
        </FormField>
      </FormSection>

      <FormSection title="Office notes" description="Never shown to the customer.">
        <FormField id="notes" label="Notes" wide error={e.notes}>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={values.notes}
            placeholder="Always needs a child seat. VIP. Flights often delayed."
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </FormSection>

      <FormMessage state={state} />
      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-5">
        <SubmitButton pending={pending}>
          {values.id ? "Save changes" : "Add customer"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
