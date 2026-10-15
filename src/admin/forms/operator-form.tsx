"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { saveOperatorAction } from "@/admin/actions/operators";
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
import { LICENSED_FROM } from "@/domain/operators/operators";

export interface OperatorFormValues {
  id?: number;
  name: string;
  legalName: string;
  licensedFrom: string;
  licensingAuthority: string;
  licenceNumber: string;
  licenceExpiresAt: string;
  hasLicenceCopy: boolean;
  operatingCentre: string;
  contactName: string;
  phone: string;
  email: string;
  whatsappConsent: boolean;
  dateJoined: string;
  dateLeft: string;
  companyNumber: string;
  vatNumber: string;
  notes: string;
}

/**
 * A subcontracting operator (Cityline, 15 Oct 2026): another licensed operator
 * Cityline passes bookings to. Only the name, who licensed them and a contact
 * phone are required; the rest is kept when known. Their bank details are
 * saved on their page, by the Owner and Accounts.
 */
export function OperatorForm({
  values,
  cancelHref,
}: {
  values: OperatorFormValues;
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveOperatorAction, EMPTY_FORM);
  const [licensedFrom, setLicensedFrom] = useState(values.licensedFrom || "tfl");
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection
        title="Operator"
        description="A licensed private hire operator who does a booking with their own driver and car. A booking may only go to an operator licensed by TfL, a district council, or in Scotland."
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
          id="legalName"
          label="Legal name"
          hint="The company's registered name, if different."
          error={e.legalName}
        >
          <input
            id="legalName"
            name="legalName"
            defaultValue={values.legalName}
            className={inputClass()}
          />
        </FormField>
        <FormField
          id="licensedFrom"
          label="Licensed from"
          required
          error={e.licensedFrom}
        >
          <select
            id="licensedFrom"
            name="licensedFrom"
            value={licensedFrom}
            onChange={(event) => setLicensedFrom(event.target.value)}
            className={inputClass()}
          >
            {Object.entries(LICENSED_FROM).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        {licensedFrom === "tfl" ? null : (
          <FormField
            id="licensingAuthority"
            label={licensedFrom === "council" ? "Which council" : "Which authority"}
            required
            error={e.licensingAuthority}
          >
            <input
              id="licensingAuthority"
              name="licensingAuthority"
              defaultValue={values.licensingAuthority}
              placeholder={
                licensedFrom === "council"
                  ? "Slough Borough Council"
                  : "Glasgow City Council"
              }
              className={inputClass()}
              {...invalid(e.licensingAuthority, "licensingAuthority")}
            />
          </FormField>
        )}
        <FormField
          id="licenceNumber"
          label="Operator licence number"
          error={e.licenceNumber}
        >
          <input
            id="licenceNumber"
            name="licenceNumber"
            defaultValue={values.licenceNumber}
            className={inputClass("tabular-nums")}
          />
        </FormField>
        <FormField
          id="licenceExpiresAt"
          label="Licence expires"
          hint="Once it has run out, no booking can go to them."
          error={e.licenceExpiresAt}
        >
          <input
            id="licenceExpiresAt"
            name="licenceExpiresAt"
            type="date"
            defaultValue={values.licenceExpiresAt}
            className={inputClass()}
            {...invalid(e.licenceExpiresAt, "licenceExpiresAt")}
          />
        </FormField>
        <FormField
          id="licenceCopy"
          label={
            values.hasLicenceCopy ? "Replace the licence copy" : "Copy of their licence"
          }
          hint="Optional. PDF, JPG, PNG or WebP, kept private."
          error={e.licenceCopy}
          wide
        >
          <input
            id="licenceCopy"
            name="licenceCopy"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="text-ink-2 file:border-line file:bg-surface file:text-ink hover:file:bg-sunken w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
            {...invalid(e.licenceCopy, "licenceCopy")}
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
        <FormField id="phone" label="Phone" required error={e.phone}>
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
              className="accent-accent h-4 w-4"
            />
            Agrees to receive jobs and statements on WhatsApp
          </label>
        </div>
      </FormSection>

      <FormSection title="With Cityline">
        <FormField id="dateJoined" label="Date joined" error={e.dateJoined}>
          <input
            id="dateJoined"
            name="dateJoined"
            type="date"
            defaultValue={values.dateJoined}
            className={inputClass()}
            {...invalid(e.dateJoined, "dateJoined")}
          />
        </FormField>
        <FormField
          id="dateLeft"
          label="Date left"
          hint="From this day no booking can go to them."
          error={e.dateLeft}
        >
          <input
            id="dateLeft"
            name="dateLeft"
            type="date"
            defaultValue={values.dateLeft}
            className={inputClass()}
            {...invalid(e.dateLeft, "dateLeft")}
          />
        </FormField>
        <FormField
          id="operatingCentre"
          label="Operating centre"
          hint="Where they take bookings."
          wide
          error={e.operatingCentre}
        >
          <textarea
            id="operatingCentre"
            name="operatingCentre"
            rows={2}
            defaultValue={values.operatingCentre}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </FormSection>

      <FormSection title="Company">
        <FormField id="companyNumber" label="Company number" error={e.companyNumber}>
          <input
            id="companyNumber"
            name="companyNumber"
            defaultValue={values.companyNumber}
            className={inputClass("tabular-nums")}
          />
        </FormField>
        <FormField id="vatNumber" label="VAT number" error={e.vatNumber}>
          <input
            id="vatNumber"
            name="vatNumber"
            defaultValue={values.vatNumber}
            className={inputClass("tabular-nums")}
          />
        </FormField>
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
          {values.id ? "Save changes" : "Add operator"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
