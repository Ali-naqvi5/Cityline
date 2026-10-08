"use client";

import { FormField, inputClass, invalid } from "@/components/ops/form";

export interface CarValues {
  registration: string;
  make: string;
  model: string;
  colour: string;
  vehicleClassSlug: string;
  seats: string;
}

export const EMPTY_CAR: CarValues = {
  registration: "",
  make: "",
  model: "",
  colour: "",
  vehicleClassSlug: "",
  seats: "",
};

/**
 * A car's details — registration, class, make, model, colour and seats — for
 * any form that adds one: a car on its own, or a driver with their car. The
 * field names are the vehicle's, so one server schema reads them all.
 */
export function CarFields({
  values,
  classes,
  errors,
}: {
  values: CarValues;
  classes: { value: string; label: string }[];
  errors: Record<string, string | undefined>;
}) {
  const e = errors;
  return (
    <>
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
      <FormField id="vehicleClassSlug" label="Class" required error={e.vehicleClassSlug}>
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
    </>
  );
}
