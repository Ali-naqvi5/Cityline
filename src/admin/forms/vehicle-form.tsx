"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { saveVehicleAction } from "@/admin/actions/fleet";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  FormSection,
  inputClass,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";
import { buttonClass } from "@/components/ops/primitives";
import { SearchSelect } from "@/components/ops/search-select";

import { CarFields } from "./car-fields";

export interface VehicleFormValues {
  id?: number;
  registration: string;
  make: string;
  model: string;
  colour: string;
  vehicleClassSlug: string;
  seats: string;
  status: string;
  /** The one driver whose car this is. */
  driver: number | null;
  notes: string;
}

export interface DriverChoice {
  id: number;
  name: string;
  phone?: string;
  /** The car they use now, if any — replaced when this one is saved. */
  currentCar?: { id: number; registration: string } | null;
}

/**
 * A car and its driver (Cityline, 9 Oct 2026): every car is one driver's
 * own — Cityline owns none, and no two drivers share one. Saving a car for a
 * driver who already has one marks the old car "no longer used".
 */
export function VehicleForm({
  values,
  classes,
  drivers,
  cancelHref,
}: {
  values: VehicleFormValues;
  classes: { value: string; label: string }[];
  drivers: DriverChoice[];
  cancelHref: string;
}) {
  const [state, action, pending] = useActionState(saveVehicleAction, EMPTY_FORM);
  const [driverId, setDriverId] = useState(values.driver ? String(values.driver) : "");
  const e = state.errors;
  const chosen = drivers.find((driver) => String(driver.id) === driverId);
  const replaces =
    chosen?.currentCar && chosen.currentCar.id !== values.id ? chosen.currentCar : null;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <FormSection title="Driver" description="The driver whose car this is.">
        {drivers.length === 0 ? (
          <p className="text-ink-3 text-sm sm:col-span-2">
            No drivers yet. Add the driver first — their car can be added with them.
          </p>
        ) : (
          <FormField
            id="drivers"
            label="Driver"
            required
            wide
            error={e.drivers}
            hint={
              replaces
                ? `Saving marks ${chosen?.name}'s car ${replaces.registration} as no longer used.`
                : "Type a name or phone number."
            }
          >
            <SearchSelect
              id="drivers"
              name="drivers"
              options={drivers.map((driver) => ({
                value: String(driver.id),
                label: driver.name,
                detail: [driver.phone, driver.currentCar?.registration]
                  .filter(Boolean)
                  .join(" · "),
              }))}
              value={driverId}
              onChange={(value) => setDriverId(String(value))}
              placeholder="Type a name"
              invalid={Boolean(e.drivers)}
              describedBy={e.drivers ? "drivers-error" : undefined}
            />
          </FormField>
        )}
      </FormSection>

      <FormSection
        title="Car"
        description="The registration and class show on each booking it does."
      >
        <CarFields values={values} classes={classes} errors={e} />
      </FormSection>

      <FormSection title="Status" description="A car off the road cannot be given jobs.">
        <FormField id="status" label="Status" required error={e.status}>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            className={inputClass()}
          >
            <option value="active">Active</option>
            <option value="off_road">Off the road</option>
            <option value="sold">No longer used</option>
          </select>
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
          {values.id ? "Save changes" : "Add car"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
