"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

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
  nationalInsuranceNumber: string;
  status: string;
  startDate: string;
  endDate: string;
  leftReason: string;
  leftForConduct: boolean;
  tflToldAt: string;
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
  const [status, setStatus] = useState(values.status);
  const [conduct, setConduct] = useState(values.leftForConduct);
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
        <FormField
          id="nationalInsuranceNumber"
          label="National Insurance number"
          error={e.nationalInsuranceNumber}
          hint="For example AB 12 34 56 C."
        >
          <input
            id="nationalInsuranceNumber"
            name="nationalInsuranceNumber"
            defaultValue={values.nationalInsuranceNumber}
            autoComplete="off"
            className={inputClass("uppercase tabular-nums")}
            {...invalid(e.nationalInsuranceNumber, "nationalInsuranceNumber")}
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
        title="With Cityline"
        description="A suspended or departed driver cannot be given jobs. TfL's driver record needs the date they became available and, once they leave, the date they stopped."
      >
        <FormField id="status" label="Status" required error={e.status}>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass()}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="left">Left</option>
          </select>
        </FormField>
        <FormField id="startDate" label="Available from" error={e.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={values.startDate}
            className={inputClass()}
          />
        </FormField>
        <FormField
          id="endDate"
          label="Stopped being available on"
          required={status === "left"}
          error={e.endDate}
          hint={status === "left" ? undefined : "Only once they have left."}
        >
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={values.endDate}
            className={inputClass()}
            {...invalid(e.endDate, "endDate")}
          />
        </FormField>
        {status === "left" ? (
          <>
            <FormField id="leftReason" label="Why they left" wide error={e.leftReason}>
              <textarea
                id="leftReason"
                name="leftReason"
                rows={2}
                defaultValue={values.leftReason}
                className={TEXTAREA_CLASS}
              />
            </FormField>
            <div className="sm:col-span-2">
              <label
                htmlFor="leftForConduct"
                className="text-ink-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  id="leftForConduct"
                  name="leftForConduct"
                  type="checkbox"
                  defaultChecked={values.leftForConduct}
                  onChange={(event) => setConduct(event.target.checked)}
                  className="accent-accent h-4 w-4"
                />
                Cityline stopped using them because of their conduct while driving a PHV
              </label>
              {conduct ? (
                <p className="text-warn mt-1 text-sm">
                  TfL must be told in writing within 14 days of the date they stopped, on
                  form PHV/105 (tphlicensingsupport@tfl.gov.uk).
                </p>
              ) : null}
            </div>
            {conduct ? (
              <FormField id="tflToldAt" label="TfL told on" error={e.tflToldAt}>
                <input
                  id="tflToldAt"
                  name="tflToldAt"
                  type="date"
                  defaultValue={values.tflToldAt}
                  className={inputClass()}
                  {...invalid(e.tflToldAt, "tflToldAt")}
                />
              </FormField>
            ) : null}
          </>
        ) : null}
      </FormSection>

      <FormSection
        title="Job messages"
        description="WhatsApp messages go only to a driver who has agreed to them (WA-05)."
      >
        <div className="sm:col-span-2">
          <label
            htmlFor="whatsappConsent"
            className="text-ink-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id="whatsappConsent"
              name="whatsappConsent"
              type="checkbox"
              defaultChecked={values.whatsappConsent}
              className="accent-accent h-4 w-4"
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
