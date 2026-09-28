"use client";

import { ArrowRight, Briefcase, Check, Luggage, Users } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { formatPence, type Pence } from "@/domain/money";
import type { VehicleOption } from "@/domain/pricing/select-vehicle";
import { policies } from "@/lib/policies";

/**
 * Step 2 vehicle selection (BK-01), ported from the step 2 design.
 *
 * Classes that cannot carry the party are rendered disabled with the reason
 * shown, rather than hidden: someone travelling with four cases should see that
 * the cheaper saloon exists and why it is not an option, otherwise the estate's
 * higher price looks arbitrary.
 *
 * Not carried over from the design: its "Live Availability · Real-Time Dispatch
 * Lock" badge. There is no live availability — allocation is manual (§1), and a
 * badge claiming otherwise is a promise the system cannot keep.
 */
export function VehicleList({
  options,
  fares,
  fareNote,
  initialSlug,
  nextHref,
}: {
  options: VehicleOption[];
  /**
   * Fare per class slug, already worked out on the server.
   *
   * Deliberately not computed here: a return journey is two fares and an
   * hourly hire is a rate times hours, and the client is never the place that
   * decides what something costs (BK-08).
   */
  fares: Record<string, Pence>;
  /** What the fare covers — "both journeys", "for 5 hours", and so on. */
  fareNote: string;
  initialSlug: string;
  /** Step 3, minus the vehicle parameter, which this component appends. */
  nextHref: string;
}) {
  const [selected, setSelected] = useState(initialSlug);
  const chosen = options.find((option) => option.vehicle.slug === selected);

  return (
    <div className="gap-space-md flex flex-col">
      <fieldset className="gap-space-md flex flex-col">
        <legend className="sr-only">Choose a vehicle class</legend>

        {options.map(({ vehicle, suitable, reason }) => {
          const isSelected = suitable && vehicle.slug === selected;

          return (
            <label
              key={vehicle.slug}
              className={[
                "rounded-card p-space-lg gap-space-lg flex flex-col border transition-all sm:flex-row sm:items-center",
                suitable
                  ? "bg-surface-container-lowest hover:shadow-card-hover cursor-pointer"
                  : "bg-surface-container-low cursor-not-allowed opacity-60",
                isSelected
                  ? "border-primary-container ring-primary-container/20 ring-2"
                  : "border-outline-variant",
              ].join(" ")}
            >
              <input
                type="radio"
                name="vehicle"
                value={vehicle.slug}
                checked={isSelected}
                disabled={!suitable}
                onChange={() => setSelected(vehicle.slug)}
                className="sr-only"
              />

              <div className="bg-surface-container-low rounded-card relative flex w-full shrink-0 items-center justify-center p-3 sm:w-44">
                <Image
                  src={vehicle.image}
                  alt=""
                  width={480}
                  height={308}
                  sizes="176px"
                  className="h-auto w-full max-w-50 object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-headline-sm">{vehicle.name}</h3>
                  {vehicle.mostPopular && suitable ? (
                    <span className="bg-tertiary-fixed text-primary text-label-sm rounded-full px-2.5 py-0.5">
                      Most booked
                    </span>
                  ) : null}
                </div>

                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  {vehicle.exampleModels}
                </p>

                <ul className="mt-space-sm text-body-sm flex flex-wrap gap-x-4 gap-y-1">
                  <li className="flex items-center gap-1.5">
                    <Users aria-hidden className="text-primary h-4 w-4" />
                    <span className="tabular-nums">{vehicle.maxPassengers}</span>
                    <span className="text-on-surface-variant">passengers</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Luggage aria-hidden className="text-primary h-4 w-4" />
                    <span className="tabular-nums">{vehicle.maxLargeBags}</span>
                    <span className="text-on-surface-variant">large cases</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Briefcase aria-hidden className="text-primary h-4 w-4" />
                    <span className="tabular-nums">{vehicle.maxHandLuggage}</span>
                    <span className="text-on-surface-variant">hand luggage</span>
                  </li>
                </ul>

                {reason ? (
                  <p className="text-body-sm text-error mt-space-sm">{reason}</p>
                ) : (
                  <p className="text-body-sm text-on-surface-variant mt-space-sm">
                    Includes meet and greet, help with luggage and{" "}
                    {policies.airportFreeWaitingMinutes} minutes free waiting.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                <p className="text-right">
                  <span className="text-fare-tabular text-primary block tabular-nums">
                    {formatPence(fares[vehicle.slug] ?? vehicle.fromPence)}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">{fareNote}</span>
                </p>

                <span
                  aria-hidden
                  className={[
                    "rounded-button text-label-md inline-flex items-center gap-1.5 px-4 py-2 font-semibold",
                    isSelected
                      ? "bg-primary-container text-on-primary"
                      : suitable
                        ? "border-outline-variant border"
                        : "border-outline-variant text-on-surface-variant border",
                  ].join(" ")}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4" />
                      Selected
                    </>
                  ) : suitable ? (
                    "Select"
                  ) : (
                    "Unavailable"
                  )}
                </span>
              </div>
            </label>
          );
        })}
      </fieldset>

      <div className="border-outline-variant pt-space-lg flex flex-col gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-on-surface-variant" aria-live="polite">
          {chosen?.suitable
            ? `${chosen.vehicle.name} selected — ${formatPence(
                fares[chosen.vehicle.slug] ?? chosen.vehicle.fromPence,
              )}`
            : "Choose a vehicle to continue."}
        </p>

        <a
          href={
            chosen?.suitable ? `${nextHref}&vehicle=${chosen.vehicle.slug}` : undefined
          }
          aria-disabled={!chosen?.suitable}
          className={[
            "rounded-button text-label-md flex h-12 items-center justify-center gap-2 px-6 font-semibold transition-colors",
            chosen?.suitable
              ? "bg-primary-container text-on-primary hover:bg-secondary"
              : "bg-surface-container-high text-on-surface-variant pointer-events-none",
          ].join(" ")}
        >
          Continue to passenger details
          <ArrowRight aria-hidden className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
