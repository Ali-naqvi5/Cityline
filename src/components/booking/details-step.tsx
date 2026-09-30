"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { JourneySummary } from "@/components/booking/journey-summary";
import { Field, fieldControlClasses } from "@/components/ui/field";
import { saveDetails } from "@/app/(public)/(booking)/book/details/actions";
import type { DetailsFormState } from "@/domain/booking/quote-session";
import type { FunnelParams } from "@/domain/booking/funnel-params";
import { funnelQuery } from "@/domain/booking/funnel-params";
import { formatPence } from "@/domain/money";
import {
  EXTRAS,
  childSeatsExceedPassengers,
  type ExtraQuantities,
} from "@/domain/pricing/extras";
import { quoteFor } from "@/domain/pricing/quote";
import type { VehicleClass } from "@/domain/pricing/vehicle-classes";
import { policies } from "@/lib/policies";
import { submitWithoutReset } from "@/lib/form-submit";

/**
 * Step 3 (BK-01, BK-04, BK-06), ported from the step 3 design.
 *
 * Form and summary live in one client component so the running total updates as
 * extras are added (§6), rather than only after a round trip.
 *
 * Two things the design showed that are not here:
 *   - "VAT receipt sent here". Cityline's VAT status is still open (§17), so
 *     the copy says "receipt" until that is settled.
 *   - "SMS automated driver arrival notifications", which implies arrival
 *     tracking. What actually happens is that the driver's details are sent
 *     when a driver is assigned (CMP-04), and the copy says that.
 */
const INITIAL_STATE: DetailsFormState = { errors: {} };

export function DetailsStep({
  journey,
  vehicle,
}: {
  journey: FunnelParams;
  vehicle: VehicleClass;
}) {
  const [state, formAction, pending] = useActionState(saveDetails, INITIAL_STATE);

  const [forSomeoneElse, setForSomeoneElse] = useState(false);
  const [quantities, setQuantities] = useState<ExtraQuantities>({});

  // One quote function for the whole funnel, so the running total here and the
  // amount charged at step 4 cannot drift apart.
  const total = quoteFor(journey, vehicle, quantities).totalPence;
  const tooManySeats = childSeatsExceedPassengers(quantities, journey.passengers);

  function setQuantity(slug: string, next: number) {
    setQuantities((current) => ({ ...current, [slug]: next }));
  }

  return (
    <form action={formAction} onSubmit={submitWithoutReset(formAction)}>
      {/* Carries the journey through to step 4 — no personal data in the URL. */}
      <input
        type="hidden"
        name="journeyQuery"
        value={funnelQuery({ ...journey, vehicle: vehicle.slug })}
      />

      <div className="gap-gutter grid lg:grid-cols-12">
        <div className="gap-space-xl flex flex-col lg:col-span-8">
          <section className="gap-space-md flex flex-col">
            <div>
              <h2 className="text-headline-sm">Lead passenger</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Your confirmation and your driver&rsquo;s details are sent here.
              </p>
            </div>

            <div className="gap-space-md grid sm:grid-cols-2">
              <Field
                id="firstName"
                name="firstName"
                label="First name"
                required
                autoComplete="given-name"
                error={state.errors.firstName}
              />
              <Field
                id="lastName"
                name="lastName"
                label="Last name"
                required
                autoComplete="family-name"
                error={state.errors.lastName}
              />
            </div>

            <Field
              id="email"
              name="email"
              type="email"
              label="Email address"
              required
              autoComplete="email"
              inputMode="email"
              hint="Your booking confirmation and receipt are sent here."
              error={state.errors.email}
            />

            <Field
              id="phone"
              name="phone"
              type="tel"
              label="Mobile phone number"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="07700 900123"
              hint="We text you your driver's name, licence number and vehicle before pickup."
              error={state.errors.phone}
            />
          </section>

          <section className="gap-space-md flex flex-col">
            <label className="flex cursor-pointer items-start gap-2.5 select-none">
              <input
                type="checkbox"
                name="bookingForSomeoneElse"
                checked={forSomeoneElse}
                onChange={(event) => setForSomeoneElse(event.target.checked)}
                className="accent-primary mt-0.5 h-5 w-5 rounded"
              />
              <span>
                <span className="text-body-md block">I am booking for someone else</span>
                <span className="text-body-sm text-on-surface-variant">
                  Tick this if the person travelling is not you.
                </span>
              </span>
            </label>

            {forSomeoneElse ? (
              <div className="border-outline-variant pl-space-md gap-space-md flex flex-col border-l-2">
                <p className="text-body-sm text-on-surface-variant">
                  The driver shows this name on the arrival board and calls this number on
                  the day.
                </p>
                <Field
                  id="passengerName"
                  name="passengerName"
                  label="Passenger's full name"
                  required
                  error={state.errors.passengerName}
                />
                <Field
                  id="passengerPhone"
                  name="passengerPhone"
                  type="tel"
                  label="Passenger's mobile number"
                  required
                  inputMode="tel"
                  error={state.errors.passengerPhone}
                />
              </div>
            ) : null}
          </section>

          <section className="gap-space-md flex flex-col">
            <div>
              <h2 className="text-headline-sm">Extras</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Child seats and extra waiting time. Meet and greet and{" "}
                {policies.airportFreeWaitingMinutes} minutes of waiting are already
                included.
              </p>
            </div>

            <ul className="gap-space-sm flex flex-col">
              {EXTRAS.map((extra) => {
                const quantity = quantities[extra.slug] ?? 0;

                return (
                  <li
                    key={extra.slug}
                    className="bg-surface-container-low/40 p-space-md rounded-card gap-space-md flex items-center justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="bg-surface-container-lowest shadow-card flex h-11 w-11 shrink-0 items-center justify-center rounded-lg p-1.5">
                        <Image
                          src={extra.image}
                          alt=""
                          width={96}
                          height={96}
                          className="h-full w-full object-contain"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="text-title-md block">{extra.name}</span>
                        <span className="text-body-sm text-on-surface-variant">
                          {extra.description}
                        </span>
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-fare-tabular tabular-nums">
                        {formatPence(extra.pricePence)}
                      </span>

                      <span className="bg-surface-container-lowest shadow-card flex items-center rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(extra.slug, Math.max(0, quantity - 1))
                          }
                          disabled={quantity === 0}
                          aria-label={`One fewer ${extra.name}`}
                          className="text-on-surface-variant hover:bg-surface-container flex h-7 w-7 items-center justify-center rounded disabled:opacity-30"
                        >
                          <Minus aria-hidden className="h-4 w-4" />
                        </button>
                        <output className="w-8 text-center text-sm tabular-nums">
                          {quantity}
                        </output>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(
                              extra.slug,
                              Math.min(extra.maxQuantity, quantity + 1),
                            )
                          }
                          disabled={quantity >= extra.maxQuantity}
                          aria-label={`One more ${extra.name}`}
                          className="text-primary hover:bg-surface-container flex h-7 w-7 items-center justify-center rounded disabled:opacity-30"
                        >
                          <Plus aria-hidden className="h-4 w-4" />
                        </button>
                      </span>
                      <input
                        type="hidden"
                        name={`extra_${extra.slug}`}
                        value={quantity}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {tooManySeats || state.errors.extras ? (
              <p role="alert" className="text-body-sm text-error">
                You have chosen more child seats than passengers. A seat is fitted for a
                passenger who is travelling, so please check the numbers.
              </p>
            ) : null}
          </section>

          <section className="gap-space-md flex flex-col">
            <h2 className="text-headline-sm">Anything else we should know?</h2>
            <div>
              <label
                htmlFor="notes"
                className="text-label-md text-on-surface mb-1.5 block"
              >
                Notes for your driver
                <span className="text-on-surface-variant ml-1.5 font-normal">
                  optional
                </span>
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={500}
                defaultValue={journey.notes}
                placeholder="Special luggage, mobility assistance, travelling with a pet, a buzzer code."
                className={`${fieldControlClasses} h-auto py-3`}
              />
            </div>
          </section>

          <section className="gap-space-md flex flex-col">
            <label className="flex cursor-pointer items-start gap-2.5 select-none">
              <input
                type="checkbox"
                name="acceptedTerms"
                className="accent-primary mt-0.5 h-5 w-5 rounded"
                aria-invalid={state.errors.acceptedTerms ? true : undefined}
              />
              {/*
                Both open in a new tab. Mid-checkout this form holds everything
                the customer has typed in client state — navigating away to read
                the terms would throw it all away and drop them back at an empty
                step 3, which is a good way to lose a booking at the last step.
              */}
              <span className="text-body-md">
                I accept the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener"
                  className="text-primary underline"
                >
                  terms and conditions
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>{" "}
                and the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  className="text-primary underline"
                >
                  privacy policy
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
                .
              </span>
            </label>
            {state.errors.acceptedTerms ? (
              <p role="alert" className="text-body-sm text-error">
                {state.errors.acceptedTerms}
              </p>
            ) : null}

            <label className="flex cursor-pointer items-start gap-2.5 select-none">
              <input
                type="checkbox"
                name="marketingConsent"
                className="accent-primary mt-0.5 h-5 w-5 rounded"
              />
              <span className="text-body-md">
                Email me occasional offers. You can unsubscribe at any time.
              </span>
            </label>
          </section>

          {/*
           * Problems that belong to the booking rather than a field — a pickup
           * that has become too soon while the form was open, a fully booked
           * day. Shown where the customer is looking when they press continue.
           */}
          {state.message ? (
            <p
              role="alert"
              className="border-error/40 text-body-md rounded-card p-space-md border"
            >
              {state.message}
              {state.offerTimeChange ? (
                <>
                  {" "}
                  <Link
                    href={`/book?${funnelQuery(journey)}`}
                    className="text-primary font-semibold underline"
                  >
                    Change the date or time
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="border-outline-variant pt-space-lg flex flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body-sm text-on-surface-variant" aria-live="polite">
              {Object.keys(state.errors).length > 0
                ? "Please check the highlighted fields."
                : "No card details until the next step."}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 items-center justify-center gap-2 px-6 font-semibold transition-colors disabled:opacity-60"
            >
              {pending ? "Checking…" : "Continue to payment"}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <JourneySummary
            journey={{ ...journey, vehicle: vehicle.slug }}
            farePence={total}
            fareLabel={`${vehicle.name} total`}
          />
        </aside>
      </div>
    </form>
  );
}
