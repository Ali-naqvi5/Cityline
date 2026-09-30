"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { changeBookingAction } from "@/app/(public)/(manage)/manage/actions";
import { EMPTY_FORM_STATE } from "@/app/(public)/(manage)/manage/form-state";
import { useEarliestBookableDate } from "@/components/booking/use-earliest-bookable-date";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { Field, fieldControlClasses } from "@/components/ui/field";
import { submitWithoutReset } from "@/lib/form-submit";

/**
 * The Manage booking change form (BK-07).
 *
 * Only what can change without changing the fare: when each journey starts,
 * the flight, who is travelling and how to reach them, and notes for the
 * driver. Everything is checked again on the server — this form is a
 * convenience, the rules live in `domain/booking/manage-booking.ts`.
 */
export interface ChangeFormLeg {
  jobId: number;
  heading: string;
  date: string;
  time: string;
}

export function ChangeForm({
  reference,
  token,
  legs,
  flightNumber,
  hasFlight,
  passengerName,
  passengerPhone,
  notes,
  backHref,
}: {
  reference: string;
  token: string;
  legs: ChangeFormLeg[];
  flightNumber: string;
  /** Only an outbound journey meets a flight. */
  hasFlight: boolean;
  passengerName: string;
  passengerPhone: string;
  notes: string;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(
    changeBookingAction,
    EMPTY_FORM_STATE,
  );
  const minDate = useEarliestBookableDate();
  const [pickups, setPickups] = useState(
    Object.fromEntries(
      legs.map((leg) => [leg.jobId, { date: leg.date, time: leg.time }]),
    ),
  );

  const setPickup = (jobId: number, part: "date" | "time", value: string) =>
    setPickups((current) => ({
      ...current,
      [jobId]: { ...current[jobId]!, [part]: value },
    }));

  return (
    <form
      action={formAction}
      onSubmit={submitWithoutReset(formAction)}
      className="gap-space-xl flex max-w-2xl flex-col"
    >
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="token" value={token} />

      {legs.map((leg) => (
        <fieldset key={leg.jobId} className="gap-space-md flex flex-col">
          <legend className="text-headline-sm mb-space-sm">{leg.heading}</legend>
          <input type="hidden" name="jobId" value={leg.jobId} />
          <div className="gap-space-md grid sm:grid-cols-2">
            <DatePicker
              id={`date_${leg.jobId}`}
              name={`date_${leg.jobId}`}
              label="Date"
              value={pickups[leg.jobId]?.date ?? ""}
              onChange={(value) => setPickup(leg.jobId, "date", value)}
              min={minDate}
              required
            />
            <TimePicker
              id={`time_${leg.jobId}`}
              name={`time_${leg.jobId}`}
              label="Pickup time"
              value={pickups[leg.jobId]?.time ?? ""}
              onChange={(value) => setPickup(leg.jobId, "time", value)}
              required
            />
          </div>
          {state.errors[`pickup_${leg.jobId}`] ? (
            <p role="alert" className="text-body-sm text-error">
              {state.errors[`pickup_${leg.jobId}`]}
            </p>
          ) : null}
        </fieldset>
      ))}

      <fieldset className="gap-space-md flex flex-col">
        <legend className="text-headline-sm mb-space-sm">Passenger and flight</legend>

        <Field
          id="passengerName"
          name="passengerName"
          label="Name on the driver's board"
          defaultValue={passengerName}
          maxLength={80}
          autoComplete="name"
          required
          error={state.errors.passengerName}
        />

        <Field
          id="passengerPhone"
          name="passengerPhone"
          type="tel"
          label="Passenger's mobile number"
          hint="Your driver calls this number on the day."
          defaultValue={passengerPhone}
          autoComplete="tel"
          required
          error={state.errors.passengerPhone}
        />

        {hasFlight ? (
          <Field
            id="flightNumber"
            name="flightNumber"
            label="Flight number"
            hint="If your flight has changed, update it here so we check the right one."
            defaultValue={flightNumber}
            maxLength={8}
            error={state.errors.flightNumber}
          />
        ) : (
          <input type="hidden" name="flightNumber" value={flightNumber} />
        )}

        <Field id="notes" label="Notes for your driver" error={state.errors.notes}>
          {/* A textarea, so passed as a child; Field's own control is an input. */}
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            defaultValue={notes}
            className={`${fieldControlClasses} h-auto py-3`}
          />
        </Field>
      </fieldset>

      <p className="text-body-sm text-on-surface-variant">
        To change an address, the vehicle, the number of passengers or the extras, please
        call us — those change the fare.
      </p>

      {state.message ? (
        <p
          role="alert"
          className="border-error/40 text-body-md rounded-card p-space-md border"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 items-center justify-center px-6 font-semibold transition-colors disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href={backHref} className="text-label-md text-primary hover:underline">
          Keep my booking as it is
        </Link>
      </div>
    </form>
  );
}
