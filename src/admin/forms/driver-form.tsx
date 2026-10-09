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
import { buttonClass, cx } from "@/components/ops/primitives";
import { DRIVER_ENGAGEMENTS } from "@/domain/compliance/documents";

import { CarFields, EMPTY_CAR } from "./car-fields";

export interface DriverFormValues {
  id?: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  dateOfBirth: string;
  nationalInsuranceNumber: string;
  engagement: string;
  status: string;
  startDate: string;
  endDate: string;
  leftReason: string;
  leftForConduct: boolean;
  tflToldAt: string;
  whatsappConsent: boolean;
  notes: string;
}

const ENGAGEMENT_HINTS: Record<string, string> = {
  registered: "A regular driver. Every document and copy is kept here, online.",
  outsourced:
    "Found for a job the regulars cannot cover. Only their details and car are kept here; their records are kept offline and never checked.",
};

export function DriverForm({
  values,
  cancelHref,
  classes = [],
}: {
  values: DriverFormValues;
  cancelHref: string;
  /** Vehicle classes, for the car a new driver is added with. */
  classes?: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveDriverAction, EMPTY_FORM);
  const [engagement, setEngagement] = useState(values.engagement || "registered");
  const [status, setStatus] = useState(values.status);
  const [conduct, setConduct] = useState(values.leftForConduct);
  const e = state.errors;
  // A new outsourced driver is added with their car, ready to assign.
  const outsourcing = !values.id && engagement === "outsourced";

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection
        title="Registered or outsourced"
        description="How this driver works with Cityline."
      >
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="sr-only">Registered or outsourced</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(DRIVER_ENGAGEMENTS).map(([value, label]) => (
              <label
                key={value}
                htmlFor={`engagement-${value}`}
                className={cx(
                  "flex cursor-pointer gap-3 rounded-md border p-3 transition-colors",
                  engagement === value
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-sunken",
                )}
              >
                <input
                  id={`engagement-${value}`}
                  type="radio"
                  name="engagement"
                  value={value}
                  checked={engagement === value}
                  onChange={() => setEngagement(value)}
                  className="accent-accent mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-ink text-sm font-semibold">{label}</span>
                  <span className="text-ink-3 text-xs">{ENGAGEMENT_HINTS[value]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

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

      {!values.id ? (
        <CarSection outsourced={outsourcing} classes={classes} errors={e} />
      ) : null}

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
          {values.id ? "Save changes" : outsourcing ? "Add driver and car" : "Add driver"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

const CAR_CHOICES = [
  ["new", "Add their car"],
  ["none", "No car yet"],
] as const;

/**
 * The driver's own car, added in the same form (Cityline, 9 Oct 2026). Every
 * car is its driver's — Cityline owns none, and no two drivers share one. An
 * outsourced driver always comes with their car, and nothing more: their
 * records are kept offline (Cityline, 10 Oct 2026). A registered driver's car
 * documents are uploaded on the car's page.
 */
function CarSection({
  outsourced,
  classes,
  errors: e,
}: {
  outsourced: boolean;
  classes: { value: string; label: string }[];
  errors: Record<string, string | undefined>;
}) {
  const [choice, setChoice] = useState<string>("new");
  const making = outsourced || choice === "new";
  return (
    <FormSection
      title="Their car"
      description={
        outsourced
          ? "Added with the driver, ready to assign. No documents are asked for: the office keeps their records offline."
          : "The driver's own car: it goes with them on every booking. Upload its documents on the car's page after saving."
      }
    >
      {outsourced ? (
        <input type="hidden" name="carChoice" value="new" />
      ) : (
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="sr-only">Their car</legend>
          <div className="flex flex-wrap gap-2">
            {CAR_CHOICES.map(([value, label]) => (
              <label
                key={value}
                htmlFor={`carChoice-${value}`}
                className={cx(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  choice === value
                    ? "border-accent bg-accent-soft text-ink font-medium"
                    : "border-line text-ink-2 hover:bg-sunken",
                )}
              >
                <input
                  id={`carChoice-${value}`}
                  type="radio"
                  name="carChoice"
                  value={value}
                  checked={choice === value}
                  onChange={() => setChoice(value)}
                  className="accent-accent h-4 w-4"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {making ? <CarFields values={EMPTY_CAR} classes={classes} errors={e} /> : null}
      {!outsourced && choice === "none" ? (
        <p className="text-ink-3 text-sm sm:col-span-2">
          Add their car later from the driver&apos;s page.
        </p>
      ) : null}
    </FormSection>
  );
}
