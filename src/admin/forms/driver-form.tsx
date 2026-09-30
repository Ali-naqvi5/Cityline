"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveDriverAction } from "@/admin/actions/fleet";
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

export interface DriverFormValues {
  id?: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  dateOfBirth: string;
  status: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  payRule: string;
  payFixed: string;
  payPercent: string;
  showPayInMessages: string;
  whatsappConsent: boolean;
  notes: string;
}

export function DriverForm({
  values,
  cancelHref,
}: {
  values: DriverFormValues;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveDriverAction, EMPTY_FORM);
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection
        title="Personal details"
        description="The phone is the driver's WhatsApp number — jobs are sent to it."
      >
        <FormField id="firstName" label="First name" required error={e.firstName}>
          <input
            id="firstName"
            name="firstName"
            defaultValue={values.firstName}
            autoComplete="off"
            className={inputClass()}
            {...invalid(e.firstName, "firstName")}
          />
        </FormField>
        <FormField id="lastName" label="Last name" required error={e.lastName}>
          <input
            id="lastName"
            name="lastName"
            defaultValue={values.lastName}
            autoComplete="off"
            className={inputClass()}
            {...invalid(e.lastName, "lastName")}
          />
        </FormField>
        <FormField
          id="phone"
          label="Mobile (WhatsApp)"
          required
          error={e.phone}
          hint="For example 07700 900123."
        >
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            className={inputClass("tabular-nums")}
            {...invalid(e.phone, "phone")}
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
        <FormField id="dateOfBirth" label="Date of birth" error={e.dateOfBirth}>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={values.dateOfBirth}
            className={inputClass()}
            {...invalid(e.dateOfBirth, "dateOfBirth")}
          />
        </FormField>
        <FormField id="address" label="Address" wide error={e.address}>
          <textarea
            id="address"
            name="address"
            rows={2}
            defaultValue={values.address}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Employment"
        description="A suspended or departed driver cannot be given jobs."
      >
        <FormField id="status" label="Status" required error={e.status}>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            className={inputClass()}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="left">Left</option>
          </select>
        </FormField>
        <FormField
          id="employmentType"
          label="Employment"
          required
          error={e.employmentType}
        >
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={values.employmentType}
            className={inputClass()}
          >
            <option value="self_employed">Self-employed</option>
            <option value="employee">Employee</option>
          </select>
        </FormField>
        <FormField id="startDate" label="Start date" error={e.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={values.startDate}
            className={inputClass()}
          />
        </FormField>
        <FormField id="endDate" label="End date" error={e.endDate}>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={values.endDate}
            className={inputClass()}
            {...invalid(e.endDate, "endDate")}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Pay"
        description="Fills in the driver's pay on each job when they are assigned. Staff can still change it on the job. Can be changed at any time."
      >
        <FormField id="payRule" label="Pay rule" required error={e.payRule}>
          <select
            id="payRule"
            name="payRule"
            defaultValue={values.payRule === "rate_card" ? "fixed" : values.payRule}
            className={inputClass()}
          >
            <option value="fixed">Fixed amount per job</option>
            <option value="percent">Percentage of net revenue</option>
          </select>
        </FormField>
        <div className="hidden sm:block" />
        <FormField
          id="payFixed"
          label="Fixed amount (£)"
          error={e.payFixed}
          hint="Used when the rule is a fixed amount."
        >
          <input
            id="payFixed"
            name="payFixed"
            inputMode="decimal"
            defaultValue={values.payFixed}
            placeholder="35.00"
            className={inputClass("tabular-nums")}
            {...invalid(e.payFixed, "payFixed")}
          />
        </FormField>
        <FormField
          id="payPercent"
          label="Percentage (%)"
          error={e.payPercent}
          hint="Used when the rule is a percentage."
        >
          <input
            id="payPercent"
            name="payPercent"
            inputMode="decimal"
            defaultValue={values.payPercent}
            placeholder="70"
            className={inputClass("tabular-nums")}
            {...invalid(e.payPercent, "payPercent")}
          />
        </FormField>
        <p className="text-ink-3 text-xs sm:col-span-2">
          Rate cards by route and vehicle class arrive with the finance screens.
        </p>
      </FormSection>

      <FormSection
        title="Job messages"
        description="WhatsApp messages go only to a driver who has agreed to them (WA-05)."
      >
        <FormField
          id="showPayInMessages"
          label="Pay in job messages"
          error={e.showPayInMessages}
        >
          <select
            id="showPayInMessages"
            name="showPayInMessages"
            defaultValue={values.showPayInMessages}
            className={inputClass()}
          >
            <option value="default">Use the company default</option>
            <option value="show">Show the pay</option>
            <option value="hide">Hide the pay</option>
          </select>
        </FormField>
        <div className="flex items-end">
          <label
            htmlFor="whatsappConsent"
            className="text-ink-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id="whatsappConsent"
              name="whatsappConsent"
              type="checkbox"
              defaultChecked={values.whatsappConsent}
              className="h-4 w-4 accent-[var(--color-accent)]"
            />
            The driver has agreed to receive jobs on WhatsApp
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
          {values.id ? "Save changes" : "Add driver"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
