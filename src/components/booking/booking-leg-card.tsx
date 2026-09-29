import { Clock, MapPin, UserCheck } from "lucide-react";

import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";
import { formatDate, formatTime } from "@/lib/time";
import type { Job } from "@/payload-types";

/**
 * One journey of a booking, as the customer sees it — on the confirmation
 * screen and in Manage booking, so the two can never describe the same trip
 * differently.
 *
 * Driver details appear once a driver is assigned (BK-07, CMP-04): the
 * licence number and the vehicle registration are copied onto the job at
 * assignment, and they are what a passenger checks before getting in.
 */
function vehicleName(slug: string): string {
  return VEHICLE_CLASSES.find((item) => item.slug === slug)?.name ?? slug;
}

export function legHeading(job: Job, jobs: readonly Job[]): string {
  if (jobs.length < 2) return "Your journey";
  return job.leg === "return" ? "Return journey" : "Outbound journey";
}

const STATUS_NOTE: Partial<Record<Job["status"], string>> = {
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "Marked as a no-show",
};

export function BookingLegCard({ job, jobs }: { job: Job; jobs: readonly Job[] }) {
  const assigned =
    (job.status === "assigned" || job.status === "driver_confirmed") &&
    (job.driverPhvNo || job.vehicleReg);
  const statusNote = STATUS_NOTE[job.status];

  return (
    <section className="border-outline-variant rounded-card p-space-lg border">
      <div className="mb-space-md flex items-baseline justify-between gap-3">
        <h2 className="text-headline-sm">{legHeading(job, jobs)}</h2>
        {statusNote ? (
          <span className="bg-surface-container-low text-on-surface-variant text-label-sm rounded-full px-3 py-1">
            {statusNote}
          </span>
        ) : null}
      </div>

      <p className="text-title-md mb-space-sm tabular-nums">
        {formatDate(new Date(job.pickupAt))} at {formatTime(new Date(job.pickupAt))}
      </p>

      <ol className="gap-space-sm text-body-md flex flex-col">
        <li className="flex gap-2">
          <MapPin aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="text-body-sm text-on-surface-variant block">Pickup</span>
            {job.pickupAddress}
          </span>
        </li>

        {(job.viaStops ?? []).map((stop, index) => (
          <li key={index} className="text-on-surface-variant flex gap-2 pl-6">
            <span>
              <span className="text-body-sm block">Stop {index + 1}</span>
              {stop.address}
            </span>
          </li>
        ))}

        {job.dropoffAddress ? (
          <li className="flex gap-2">
            <MapPin aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="text-body-sm text-on-surface-variant block">Drop-off</span>
              {job.dropoffAddress}
            </span>
          </li>
        ) : (
          <li className="flex gap-2">
            <Clock aria-hidden className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="text-body-sm text-on-surface-variant block">
                Hourly hire
              </span>
              {job.hours} hours with your driver
            </span>
          </li>
        )}
      </ol>

      <dl className="border-outline-variant mt-space-md pt-space-md text-body-md grid gap-2 border-t sm:grid-cols-2">
        <div>
          <dt className="text-body-sm text-on-surface-variant">Vehicle</dt>
          <dd>{vehicleName(job.vehicleClassSlug)}</dd>
        </div>
        <div>
          <dt className="text-body-sm text-on-surface-variant">Passengers</dt>
          <dd className="tabular-nums">{job.passengers}</dd>
        </div>
        <div>
          <dt className="text-body-sm text-on-surface-variant">
            Name on the driver&rsquo;s board
          </dt>
          <dd>{job.nameBoardText ?? job.leadName}</dd>
        </div>
        {job.flightNumber ? (
          <div>
            <dt className="text-body-sm text-on-surface-variant">Flight</dt>
            <dd className="tabular-nums">{job.flightNumber}</dd>
          </div>
        ) : null}
      </dl>

      {assigned ? (
        <div className="bg-surface-container-low rounded-card p-space-md mt-space-md">
          <p className="text-title-md mb-1 flex items-center gap-2">
            <UserCheck aria-hidden className="text-primary h-5 w-5" />
            Your driver is assigned
          </p>
          <dl className="text-body-md grid gap-1 sm:grid-cols-2">
            {job.vehicleReg ? (
              <div>
                <dt className="text-body-sm text-on-surface-variant">Registration</dt>
                <dd className="font-semibold tracking-wide tabular-nums">
                  {job.vehicleReg}
                </dd>
              </div>
            ) : null}
            {job.driverPhvNo ? (
              <div>
                <dt className="text-body-sm text-on-surface-variant">
                  Driver&rsquo;s licence number
                </dt>
                <dd className="tabular-nums">{job.driverPhvNo}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-body-sm text-on-surface-variant mt-2">
            Check the registration before you get in.
          </p>
        </div>
      ) : null}
    </section>
  );
}
