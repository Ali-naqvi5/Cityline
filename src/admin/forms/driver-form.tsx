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
import { SearchSelect, type SearchOption } from "@/components/ops/search-select";
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
    "Found for a job the regulars cannot cover. Type in their licences and car; keep copies of the documents offline.",
};

export function DriverForm({
  values,
  cancelHref,
  classes = [],
  cars = [],
}: {
  values: DriverFormValues;
  cancelHref: string;
  /** Vehicle classes, for the car a new driver is added with. */
  classes?: { value: string; label: string }[];
  /** Cars already on record, for a new driver who drives one of them. */
  cars?: SearchOption[];
}) {
  const [state, action, pending] = useActionState(saveDriverAction, EMPTY_FORM);
  const [engagement, setEngagement] = useState(values.engagement || "registered");
  const [status, setStatus] = useState(values.status);
  const [conduct, setConduct] = useState(values.leftForConduct);
  const e = state.errors;
  // A new outsourced driver is added with their licences and car.
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

      {outsourcing ? <LicencesSection errors={e} /> : null}
      {!values.id ? (
        <CarSection outsourced={outsourcing} classes={classes} cars={cars} errors={e} />
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

/** A date field for a licence or certificate's expiry. */
function ExpiryField({
  id,
  label,
  error,
}: {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <FormField id={id} label={label} required error={error}>
      <input
        id={id}
        name={id}
        type="date"
        className={inputClass()}
        {...invalid(error, id)}
      />
    </FormField>
  );
}

function NumberField({
  id,
  label,
  error,
}: {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <FormField id={id} label={label} required error={error}>
      <input
        id={id}
        name={id}
        autoComplete="off"
        className={inputClass("uppercase tabular-nums")}
        {...invalid(error, id)}
      />
    </FormField>
  );
}

/** An outsourced driver's licences, typed in from the documents seen. */
function LicencesSection({ errors: e }: { errors: Record<string, string | undefined> }) {
  return (
    <FormSection
      title="Licences"
      description="From the documents you have seen. Keep the copies offline; these are what dispatch checks."
    >
      <NumberField id="phvNumber" label="PHV driver licence number" error={e.phvNumber} />
      <ExpiryField
        id="phvExpiry"
        label="PHV driver licence expires"
        error={e.phvExpiry}
      />
      <NumberField id="dvlaNumber" label="Driving licence number" error={e.dvlaNumber} />
      <ExpiryField id="dvlaExpiry" label="Driving licence expires" error={e.dvlaExpiry} />
    </FormSection>
  );
}

const CAR_CHOICES = [
  ["new", "A new car"],
  ["existing", "A car already on record"],
  ["none", "No car yet"],
] as const;

/**
 * The driver's car, added in the same form (Cityline, 9 Oct 2026): a new
 * car, one already on record, or none yet. An outsourced driver comes with
 * a new car and its licences, typed in; a registered driver's car documents
 * are uploaded on the car's page after saving.
 */
function CarSection({
  outsourced,
  classes,
  cars,
  errors: e,
}: {
  outsourced: boolean;
  classes: { value: string; label: string }[];
  cars: SearchOption[];
  errors: Record<string, string | undefined>;
}) {
  const [choice, setChoice] = useState<string>("new");
  const [existing, setExisting] = useState("");
  const making = outsourced || choice === "new";
  return (
    <FormSection
      title="Their car"
      description={
        outsourced
          ? "Added with the driver and linked to them, ready to assign."
          : "Linked to the driver, so dispatch offers it with them. Upload its documents on the car's page after saving."
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
      {!outsourced && choice === "existing" ? (
        <FormField id="existingCar" label="Car" required wide error={e.existingCar}>
          <SearchSelect
            id="existingCar"
            name="existingCar"
            options={cars}
            value={existing}
            onChange={(value) => setExisting(String(value))}
            placeholder="Type a registration or model"
            invalid={Boolean(e.existingCar)}
            describedBy={e.existingCar ? "existingCar-error" : undefined}
          />
        </FormField>
      ) : null}
      {!outsourced && choice === "none" ? (
        <p className="text-ink-3 text-sm sm:col-span-2">
          Link a car later from the driver&apos;s page or the car&apos;s.
        </p>
      ) : null}
      {outsourced ? (
        <>
          <NumberField
            id="vehicleLicenceNumber"
            label="PHV vehicle licence number"
            error={e.vehicleLicenceNumber}
          />
          <ExpiryField
            id="vehicleLicenceExpiry"
            label="PHV vehicle licence expires"
            error={e.vehicleLicenceExpiry}
          />
          <ExpiryField id="motExpiry" label="MOT expires" error={e.motExpiry} />
          <ExpiryField
            id="insuranceExpiry"
            label="Hire and reward insurance expires"
            error={e.insuranceExpiry}
          />
          <div className="sm:col-span-2">
            <label
              htmlFor="seenOriginals"
              className="text-ink-2 flex min-h-10 cursor-pointer items-start gap-2 text-sm"
            >
              <input
                id="seenOriginals"
                name="seenOriginals"
                type="checkbox"
                className="accent-accent mt-0.5 h-4 w-4 shrink-0"
                {...invalid(e.seenOriginals, "seenOriginals")}
              />
              I have seen the original documents, and the office keeps copies of them
              offline
            </label>
            {e.seenOriginals ? (
              <p id="seenOriginals-error" className="text-danger mt-1 text-sm">
                {e.seenOriginals}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </FormSection>
  );
}
