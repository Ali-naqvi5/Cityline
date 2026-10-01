"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { saveJobAction } from "@/admin/actions/dispatch";
import { EMPTY_FORM, type JobFormState } from "@/admin/form-state";
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
import {
  JOB_SOURCE_LABELS,
  MAX_STOPS,
  PAYMENT_METHOD_LABELS,
  STAFF_PAYMENT_METHODS,
  STAFF_SOURCES,
} from "@/domain/jobs/labels";
import { EXTRAS } from "@/domain/pricing/extras";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

export interface JobFormValues {
  id?: number;
  returnOf?: number;
  source: string;
  supplier: string;
  supplierReference: string;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  stops: string[];
  dropoffAddress: string;
  hours: string;
  flightNumber: string;
  vehicleClassSlug: string;
  passengers: string;
  largeBags: string;
  smallBags: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  nameBoardText: string;
  meetAndGreet: boolean;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  extras: Record<string, number>;
  price: string;
  paymentMethod: string;
  commissionPercent: string;
  driverNotes: string;
  internalNotes: string;
  notifyPassenger: boolean;
  isTest: boolean;
}

export interface SupplierChoice {
  id: number;
  name: string;
  commissionPercent: string;
}

function Check({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <div className="sm:col-span-2">
      <label
        htmlFor={name}
        className="text-ink-2 flex min-h-10 cursor-pointer items-center gap-2 text-sm"
      >
        <input
          id={name}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        {label}
      </label>
      {hint ? <p className="text-ink-3 -mt-1 ml-6 text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * The staff job form (spec §13). `website` mode is for a website booking's
 * job: only the operational details, with price, customer and route shown as
 * locked (JOB-07).
 */
export function JobForm({
  values,
  suppliers,
  cancelHref,
  mode,
  locked,
}: {
  values: JobFormValues;
  suppliers: SupplierChoice[];
  cancelHref: string;
  mode: "new" | "edit" | "website";
  locked?: ReactNode;
}) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(
    saveJobAction,
    EMPTY_FORM,
  );
  const e = state.errors;
  const [source, setSource] = useState(values.source);
  const [commission, setCommission] = useState(values.commissionPercent);
  const [stops, setStops] = useState(() =>
    values.stops.map((address, index) => ({ key: index, address })),
  );
  const [nextKey, setNextKey] = useState(values.stops.length);
  const website = mode === "website";
  const supplierJob = source === "supplier";

  function chooseSupplier(id: string) {
    const supplier = suppliers.find((item) => String(item.id) === id);
    if (supplier) setCommission(supplier.commissionPercent);
  }

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-6" noValidate>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {values.returnOf ? (
        <input type="hidden" name="returnOf" value={values.returnOf} />
      ) : null}

      {website ? locked : null}

      {!website ? (
        <FormSection
          title="Source"
          description="Where the job came from. It cannot change later. Website bookings come only from the website."
        >
          <FormField id="source" label="Source" required error={e.source}>
            {mode === "edit" ? (
              <>
                <input type="hidden" name="source" value={source} />
                <p className="text-ink flex h-10 items-center text-base lg:h-9 lg:text-sm">
                  {JOB_SOURCE_LABELS[source as keyof typeof JOB_SOURCE_LABELS] ?? source}
                </p>
              </>
            ) : (
              <select
                id="source"
                name="source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className={inputClass()}
                {...invalid(e.source, "source")}
              >
                <option value="">Choose…</option>
                {STAFF_SOURCES.map((item) => (
                  <option key={item} value={item}>
                    {JOB_SOURCE_LABELS[item]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          {supplierJob ? (
            <>
              <FormField id="supplier" label="Supplier" required error={e.supplier}>
                <select
                  id="supplier"
                  name="supplier"
                  defaultValue={values.supplier}
                  onChange={(event) => chooseSupplier(event.target.value)}
                  className={inputClass()}
                  {...invalid(e.supplier, "supplier")}
                >
                  <option value="">Choose…</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id="supplierReference"
                label="Supplier's reference"
                required
                error={e.supplierReference}
                hint="Their booking number. The same one cannot be entered twice."
              >
                <input
                  id="supplierReference"
                  name="supplierReference"
                  defaultValue={values.supplierReference}
                  autoComplete="off"
                  className={inputClass("uppercase")}
                  {...invalid(e.supplierReference, "supplierReference")}
                />
              </FormField>
            </>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection title="When and where">
        <FormField id="pickupDate" label="Pickup date" required error={e.pickupDate}>
          <input
            id="pickupDate"
            name="pickupDate"
            type="date"
            defaultValue={values.pickupDate}
            className={inputClass()}
            {...invalid(e.pickupDate, "pickupDate")}
          />
        </FormField>
        <FormField
          id="pickupTime"
          label="Pickup time"
          required
          error={e.pickupTime}
          hint="London time."
        >
          <input
            id="pickupTime"
            name="pickupTime"
            type="time"
            defaultValue={values.pickupTime}
            className={inputClass()}
            {...invalid(e.pickupTime, "pickupTime")}
          />
        </FormField>
        {!website ? (
          <>
            <FormField
              id="pickupAddress"
              label="Pickup address"
              required
              wide
              error={e.pickupAddress}
              hint="For an airport, include the terminal."
            >
              <input
                id="pickupAddress"
                name="pickupAddress"
                defaultValue={values.pickupAddress}
                className={inputClass()}
                {...invalid(e.pickupAddress, "pickupAddress")}
              />
            </FormField>
            <div className="flex flex-col gap-2 sm:col-span-2">
              {stops.map((stop, index) => (
                <div key={stop.key} className="flex items-end gap-2">
                  <FormField id={`stop-${stop.key}`} label={`Stop ${index + 1}`} wide>
                    <input
                      id={`stop-${stop.key}`}
                      name="stop"
                      defaultValue={stop.address}
                      className={inputClass()}
                    />
                  </FormField>
                  <button
                    type="button"
                    aria-label={`Remove stop ${index + 1}`}
                    className={buttonClass("ghost", "md", "px-2.5")}
                    onClick={() =>
                      setStops(stops.filter((item) => item.key !== stop.key))
                    }
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {stops.length < MAX_STOPS ? (
                <button
                  type="button"
                  className={buttonClass("ghost", "sm", "self-start")}
                  onClick={() => {
                    setStops([...stops, { key: nextKey, address: "" }]);
                    setNextKey(nextKey + 1);
                  }}
                >
                  <Plus aria-hidden className="h-4 w-4" />
                  Add a stop
                </button>
              ) : null}
            </div>
            <FormField
              id="dropoffAddress"
              label="Drop-off address"
              wide
              error={e.dropoffAddress}
              hint="Leave empty for an hourly hire, and enter the hours."
            >
              <input
                id="dropoffAddress"
                name="dropoffAddress"
                defaultValue={values.dropoffAddress}
                className={inputClass()}
                {...invalid(e.dropoffAddress, "dropoffAddress")}
              />
            </FormField>
            <FormField id="hours" label="Hours (hourly hire)" error={e.hours}>
              <input
                id="hours"
                name="hours"
                inputMode="numeric"
                defaultValue={values.hours}
                className={inputClass("tabular-nums")}
              />
            </FormField>
          </>
        ) : null}
        <FormField
          id="flightNumber"
          label="Flight number"
          error={e.flightNumber}
          hint="So the office can check the arrival time before dispatch."
        >
          <input
            id="flightNumber"
            name="flightNumber"
            defaultValue={values.flightNumber}
            autoComplete="off"
            className={inputClass("uppercase")}
            {...invalid(e.flightNumber, "flightNumber")}
          />
        </FormField>
      </FormSection>

      <FormSection title="Passengers">
        {!website ? (
          <FormField
            id="vehicleClassSlug"
            label="Vehicle class"
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
              <option value="">Choose…</option>
              {VEHICLE_CLASSES.map((vehicle) => (
                <option key={vehicle.slug} value={vehicle.slug}>
                  {vehicle.name} — up to {vehicle.maxPassengers} passengers
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <FormField id="passengers" label="Passengers" required error={e.passengers}>
          <input
            id="passengers"
            name="passengers"
            inputMode="numeric"
            defaultValue={values.passengers}
            className={inputClass("tabular-nums")}
            {...invalid(e.passengers, "passengers")}
          />
        </FormField>
        <FormField id="largeBags" label="Large bags" error={e.largeBags}>
          <input
            id="largeBags"
            name="largeBags"
            inputMode="numeric"
            defaultValue={values.largeBags}
            className={inputClass("tabular-nums")}
            {...invalid(e.largeBags, "largeBags")}
          />
        </FormField>
        <FormField id="smallBags" label="Small bags" error={e.smallBags}>
          <input
            id="smallBags"
            name="smallBags"
            inputMode="numeric"
            defaultValue={values.smallBags}
            className={inputClass("tabular-nums")}
            {...invalid(e.smallBags, "smallBags")}
          />
        </FormField>
        {!website ? (
          <>
            <FormField id="leadName" label="Lead passenger" required error={e.leadName}>
              <input
                id="leadName"
                name="leadName"
                defaultValue={values.leadName}
                autoComplete="off"
                className={inputClass()}
                {...invalid(e.leadName, "leadName")}
              />
            </FormField>
            <FormField
              id="leadPhone"
              label="Passenger phone"
              required
              error={e.leadPhone}
            >
              <input
                id="leadPhone"
                name="leadPhone"
                type="tel"
                defaultValue={values.leadPhone}
                autoComplete="off"
                className={inputClass("tabular-nums")}
                {...invalid(e.leadPhone, "leadPhone")}
              />
            </FormField>
            <FormField id="leadEmail" label="Passenger email" error={e.leadEmail}>
              <input
                id="leadEmail"
                name="leadEmail"
                type="email"
                defaultValue={values.leadEmail}
                autoComplete="off"
                className={inputClass()}
                {...invalid(e.leadEmail, "leadEmail")}
              />
            </FormField>
          </>
        ) : null}
        <FormField
          id="nameBoardText"
          label="Name board"
          error={e.nameBoardText}
          hint="What the driver's board says. The passenger's name if empty."
        >
          <input
            id="nameBoardText"
            name="nameBoardText"
            defaultValue={values.nameBoardText}
            autoComplete="off"
            className={inputClass()}
          />
        </FormField>
        <Check
          name="meetAndGreet"
          label="Meet and greet — the driver waits in arrivals with a name board"
          defaultChecked={values.meetAndGreet}
        />
      </FormSection>

      {!website ? (
        <>
          <FormSection
            title="Booker"
            description="Only if someone else booked — a PA, a travel agent."
          >
            <FormField id="bookerName" label="Booker's name" error={e.bookerName}>
              <input
                id="bookerName"
                name="bookerName"
                defaultValue={values.bookerName}
                autoComplete="off"
                className={inputClass()}
              />
            </FormField>
            <FormField id="bookerPhone" label="Booker's phone" error={e.bookerPhone}>
              <input
                id="bookerPhone"
                name="bookerPhone"
                type="tel"
                defaultValue={values.bookerPhone}
                autoComplete="off"
                className={inputClass("tabular-nums")}
                {...invalid(e.bookerPhone, "bookerPhone")}
              />
            </FormField>
            <FormField id="bookerEmail" label="Booker's email" error={e.bookerEmail}>
              <input
                id="bookerEmail"
                name="bookerEmail"
                type="email"
                defaultValue={values.bookerEmail}
                autoComplete="off"
                className={inputClass()}
                {...invalid(e.bookerEmail, "bookerEmail")}
              />
            </FormField>
          </FormSection>

          <FormSection title="Extras" description="Part of the agreed price.">
            {EXTRAS.map((extra) => (
              <FormField key={extra.slug} id={`extra-${extra.slug}`} label={extra.name}>
                <select
                  id={`extra-${extra.slug}`}
                  name={`extra-${extra.slug}`}
                  defaultValue={String(values.extras[extra.slug] ?? 0)}
                  className={inputClass("tabular-nums")}
                >
                  {Array.from({ length: extra.maxQuantity + 1 }, (_, quantity) => (
                    <option key={quantity} value={quantity}>
                      {quantity === 0 ? "None" : quantity}
                    </option>
                  ))}
                </select>
              </FormField>
            ))}
          </FormSection>

          <FormSection
            title="Price"
            description="The fare agreed before the journey (CMP-02)."
          >
            <FormField id="price" label="Agreed price (£)" required error={e.price}>
              <input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={values.price}
                className={inputClass("tabular-nums")}
                {...invalid(e.price, "price")}
              />
            </FormField>
            <FormField
              id="paymentMethod"
              label="Payment"
              required
              error={e.paymentMethod}
            >
              <select
                id="paymentMethod"
                name="paymentMethod"
                key={supplierJob ? "supplier" : "direct"}
                defaultValue={supplierJob ? "supplier" : values.paymentMethod}
                className={inputClass()}
                {...invalid(e.paymentMethod, "paymentMethod")}
              >
                <option value="">Choose…</option>
                {STAFF_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </FormField>
            {supplierJob ? (
              <FormField
                id="commissionPercent"
                label="Supplier commission (%)"
                required
                error={e.commissionPercent}
                hint="From the supplier's default. Change it if this job differs."
              >
                <input
                  id="commissionPercent"
                  name="commissionPercent"
                  inputMode="decimal"
                  value={commission}
                  onChange={(event) => setCommission(event.target.value)}
                  className={inputClass("tabular-nums")}
                  {...invalid(e.commissionPercent, "commissionPercent")}
                />
              </FormField>
            ) : null}
          </FormSection>
        </>
      ) : null}

      <FormSection title="Notes">
        <FormField
          id="driverNotes"
          label="Notes for the driver"
          wide
          hint="Go in the driver's WhatsApp message."
        >
          <textarea
            id="driverNotes"
            name="driverNotes"
            rows={3}
            defaultValue={values.driverNotes}
            className={TEXTAREA_CLASS}
          />
        </FormField>
        <FormField id="internalNotes" label="Internal notes" wide hint="Office only.">
          <textarea
            id="internalNotes"
            name="internalNotes"
            rows={3}
            defaultValue={values.internalNotes}
            className={TEXTAREA_CLASS}
          />
        </FormField>
        <Check
          name="notifyPassenger"
          label="Email the passenger their driver's details when a driver is assigned"
          defaultChecked={values.notifyPassenger}
          hint="Some suppliers contact their passengers themselves."
        />
        {!website ? (
          <Check
            name="isTest"
            label="Test job — kept out of reports and the TfL register"
            defaultChecked={values.isTest}
          />
        ) : null}
      </FormSection>

      {state.duplicates?.length ? (
        <div
          role="alert"
          className="border-warn-line bg-warn-soft flex flex-col gap-3 rounded-md border p-4"
        >
          <p className="text-warn flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            This may already be entered
          </p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {state.duplicates.map((duplicate) => (
              <li key={duplicate.id}>
                <Link
                  href={`/admin/jobs/${duplicate.id}`}
                  target="_blank"
                  className="text-accent font-medium hover:underline"
                >
                  {duplicate.reference}
                </Link>{" "}
                · {duplicate.when} · {duplicate.passenger}{" "}
                <span className="text-ink-3">({duplicate.reasons.join(", ")})</span>
              </li>
            ))}
          </ul>
          <p className="text-ink-2 text-sm">
            If this is a different trip, save it anyway. Otherwise, go back.
          </p>
          <div>
            <button
              type="submit"
              name="confirmDuplicate"
              value="1"
              disabled={pending}
              className={buttonClass("secondary", "md")}
            >
              It is a different trip — save anyway
            </button>
          </div>
        </div>
      ) : (
        <FormMessage state={state} />
      )}

      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-5">
        <SubmitButton pending={pending}>
          {mode === "new"
            ? values.returnOf
              ? "Create return trip"
              : "Create job"
            : "Save changes"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass("ghost", "md")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
