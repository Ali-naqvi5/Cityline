"use client";

import Link from "next/link";
import { useActionState } from "react";

import { saveVehicleAction } from "@/admin/actions/fleet";
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

export interface VehicleFormValues {
  id?: number;
  registration: string;
  make: string;
  model: string;
  colour: string;
  vehicleClassSlug: string;
  seats: string;
  ownership: string;
  status: string;
  drivers: number[];
  notes: string;
}

export function VehicleForm({
  values,
  classes,
  drivers,
  cancelHref,
}: {
  values: VehicleFormValues;
  classes: { value: string; label: string }[];
  drivers: { id: number; name: string }[];
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveVehicleAction, EMPTY_FORM);
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection
        title="Vehicle"
        description="The registration and class are what dispatch checks against each job."
      >
        <FormField id="registration" label="Registration" required error={e.registration}>
          <input
            id="registration"
            name="registration"
            defaultValue={values.registration}
            autoComplete="off"
            className={inputClass("uppercase tabular-nums")}
            {...invalid(e.registration, "registration")}
          />
        </FormField>
        <FormField
          id="vehicleClassSlug"
          label="Class"
          required
          error={e.vehicleClassSlug}
        >
          <select
            id="vehicleClassSlug"
            name="vehicleClassSlug"
            defaultValue={values.vehicleClassSlug}
            className={inputClass()}
            {...invalid(e.vehicleClassSlug, "vehicleClassSlug")}
          >
            <option value="" disabled>
              Choose…
            </option>
            {classes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="make" label="Make" required error={e.make}>
          <input
            id="make"
            name="make"
            defaultValue={values.make}
            className={inputClass()}
            {...invalid(e.make, "make")}
          />
        </FormField>
        <FormField id="model" label="Model" required error={e.model}>
          <input
            id="model"
            name="model"
            defaultValue={values.model}
            className={inputClass()}
            {...invalid(e.model, "model")}
          />
        </FormField>
        <FormField
          id="colour"
          label="Colour"
          required
          error={e.colour}
          hint="Passengers are told the colour when a driver is assigned."
        >
          <input
            id="colour"
            name="colour"
            defaultValue={values.colour}
            className={inputClass()}
            {...invalid(e.colour, "colour")}
          />
        </FormField>
        <FormField id="seats" label="Passenger seats" error={e.seats}>
          <input
            id="seats"
            name="seats"
            inputMode="numeric"
            defaultValue={values.seats}
            className={inputClass("tabular-nums")}
            {...invalid(e.seats, "seats")}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Status and ownership"
        description="A vehicle off the road cannot be given jobs."
      >
        <FormField id="status" label="Status" required error={e.status}>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            className={inputClass()}
          >
            <option value="active">Active</option>
            <option value="off_road">Off the road</option>
            <option value="sold">Sold or returned</option>
          </select>
        </FormField>
        <FormField id="ownership" label="Ownership" required error={e.ownership}>
          <select
            id="ownership"
            name="ownership"
            defaultValue={values.ownership}
            className={inputClass()}
          >
            <option value="driver">Driver-owned</option>
            <option value="company">Company-owned</option>
            <option value="hired">Hired</option>
          </select>
        </FormField>
      </FormSection>

      <FormSection
        title="Drivers"
        description="Who normally drives this vehicle. Dispatch suggests it for them."
      >
        {drivers.length === 0 ? (
          <p className="text-ink-3 text-sm sm:col-span-2">
            No drivers yet. Add drivers first, then link them here.
          </p>
        ) : (
          <div className="grid gap-1 sm:col-span-2 sm:grid-cols-2">
            {drivers.map((driver) => (
              <label
                key={driver.id}
                htmlFor={`driver-${driver.id}`}
                className="text-ink-2 flex min-h-9 cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  id={`driver-${driver.id}`}
                  type="checkbox"
                  name="drivers"
                  value={driver.id}
                  defaultChecked={values.drivers.includes(driver.id)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                {driver.name}
              </label>
            ))}
          </div>
        )}
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
          {values.id ? "Save changes" : "Add vehicle"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
