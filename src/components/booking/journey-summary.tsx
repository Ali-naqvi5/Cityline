import {
  ArrowDown,
  Calendar,
  Clock,
  Flag,
  Hourglass,
  Luggage,
  MapPin,
  PlaneLanding,
  Users,
} from "lucide-react";
import Link from "next/link";

import type { FunnelParams } from "@/domain/booking/funnel-params";
import { funnelQuery, returnLegOf } from "@/domain/booking/funnel-params";
import { formatPence, type Pence } from "@/domain/money";
import { policies } from "@/lib/policies";

/**
 * The journey summary that rides alongside steps 2 to 4, with the running
 * total §6 asks for.
 *
 * It always offers a way back to step 1 — someone who spots a wrong date here
 * should not have to use the back button and hope.
 */
export function JourneySummary({
  journey,
  farePence,
  fareLabel,
}: {
  journey: FunnelParams;
  /** Omitted until a vehicle has been chosen. */
  farePence?: Pence;
  fareLabel?: string;
}) {
  const editHref = `/book?${funnelQuery(journey)}`;
  const back = returnLegOf(journey);
  const isHourly = journey.service === "hourly";

  return (
    <div className="border-outline-variant bg-surface-container-lowest rounded-card shadow-card sticky top-28 border">
      <div className="border-outline-variant p-space-lg flex items-center justify-between border-b">
        <h2 className="text-headline-sm">Your journey</h2>
        <Link href={editHref} className="text-label-md text-primary hover:underline">
          Change
        </Link>
      </div>

      <div className="p-space-lg gap-space-md flex flex-col">
        <div className="flex flex-col gap-1.5">
          <p className="flex gap-2">
            <MapPin aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-body-md">{journey.pickup}</span>
          </p>

          {journey.via.map((stop, index) => (
            <p key={index} className="flex gap-2">
              <ArrowDown
                aria-hidden
                className="text-on-surface-variant mt-0.5 h-4 w-4 shrink-0"
              />
              <span className="text-body-sm text-on-surface-variant">via {stop}</span>
            </p>
          ))}

          {isHourly ? (
            <p className="flex gap-2">
              <Hourglass aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-body-md">
                {journey.hours} {journey.hours === 1 ? "hour" : "hours"} of hire, wherever
                you need to go
              </span>
            </p>
          ) : (
            <p className="flex gap-2">
              <Flag aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-body-md">{journey.dropoff}</span>
            </p>
          )}
        </div>

        <dl className="border-outline-variant pt-space-md text-body-sm grid gap-2 border-t">
          <div className="flex items-center gap-2">
            <Calendar aria-hidden className="text-on-surface-variant h-4 w-4 shrink-0" />
            <dt className="sr-only">Pickup date</dt>
            <dd className="tabular-nums">{journey.date || "Date not set"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock aria-hidden className="text-on-surface-variant h-4 w-4 shrink-0" />
            <dt className="sr-only">Pickup time</dt>
            <dd className="tabular-nums">{journey.time || "Time not set"}</dd>
          </div>
          {journey.flightNumber ? (
            <div className="flex items-center gap-2">
              <PlaneLanding
                aria-hidden
                className="text-on-surface-variant h-4 w-4 shrink-0"
              />
              <dt className="sr-only">Flight</dt>
              <dd className="tabular-nums">{journey.flightNumber}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Users aria-hidden className="text-on-surface-variant h-4 w-4 shrink-0" />
            <dt className="sr-only">Passengers</dt>
            <dd className="tabular-nums">
              {journey.passengers} {journey.passengers === 1 ? "passenger" : "passengers"}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Luggage aria-hidden className="text-on-surface-variant h-4 w-4 shrink-0" />
            <dt className="sr-only">Luggage</dt>
            <dd className="tabular-nums">
              {journey.bags} large {journey.bags === 1 ? "case" : "cases"}
            </dd>
          </div>
        </dl>

        {back ? (
          <div className="bg-surface-container-low text-body-sm rounded-card p-space-md flex flex-col gap-1.5">
            <p className="text-label-sm text-on-surface-variant uppercase">
              Return journey
            </p>
            <p className="flex gap-2">
              <MapPin aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <span>{back.pickup}</span>
            </p>
            {back.via.map((stop, index) => (
              <p key={index} className="flex gap-2">
                <ArrowDown
                  aria-hidden
                  className="text-on-surface-variant mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="text-on-surface-variant">via {stop}</span>
              </p>
            ))}
            <p className="flex gap-2">
              <Flag aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
              <span>{back.dropoff}</span>
            </p>
            <p className="text-on-surface-variant tabular-nums">
              {back.date || "Date to confirm"}
              {back.time ? ` at ${back.time}` : ""}
              {back.passengers !== journey.passengers || back.bags !== journey.bags
                ? ` · ${back.passengers} ${back.passengers === 1 ? "passenger" : "passengers"}, ${back.bags} large ${back.bags === 1 ? "case" : "cases"}`
                : ""}
            </p>
            <p className="text-on-surface-variant">Priced with your outbound journey.</p>
          </div>
        ) : null}

        {farePence === undefined ? (
          <p className="border-outline-variant pt-space-md text-body-sm text-on-surface-variant border-t">
            Choose a vehicle to see your fare.
          </p>
        ) : (
          <div className="border-outline-variant pt-space-md border-t">
            <div className="flex items-end justify-between">
              <span className="text-body-md">{fareLabel ?? "Total"}</span>
              <span className="text-fare-tabular text-primary tabular-nums">
                {formatPence(farePence)}
              </span>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Fixed fare. Congestion charges and {policies.airportFreeWaitingMinutes}{" "}
              minutes of free waiting included. No card fees.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
