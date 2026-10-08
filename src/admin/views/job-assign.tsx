import { ArrowLeft, Plane, UsersRound } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { loadAssignmentBoard } from "@/admin/data/dispatch";
import { pickupLabel, relative } from "@/admin/format";
import { AssignForm } from "@/admin/forms/assign-form";
import { requireStaff, segment } from "@/admin/guard";
import { JobStatusBadge, Route } from "@/components/ops/jobs";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { relId } from "@/domain/dispatch/assignment";
import { vehicleClassName } from "@/domain/jobs/labels";
import { beforeBoarding, isFinal } from "@/domain/jobs/status";
import type { Job } from "@/payload-types";

/**
 * Assigning a driver and car to a job (`/jobs/:id/assign`, spec §19): every
 * driver and every car, one search for both, any driver with any car
 * (Cityline, 9 Oct 2026). What cannot legally go is shown with the reason.
 */
export async function JobAssignView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const context = requireStaff(props, "jobs.dispatch", `/admin/jobs/${idSegment}/assign`);
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const job = (await payload.findByID({
    collection: "jobs",
    id: Number(idSegment),
    depth: 0,
    user,
    overrideAccess: false,
    disableErrors: true,
  })) as Job | null;

  if (!job) {
    return (
      <OpsShell user={user} active="dispatch">
        <Panel>
          <EmptyState
            title="No job with that number"
            action={<ButtonLink href="/admin/dispatch">Back to dispatch</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const back = `/admin/jobs/${job.id}`;
  if (!beforeBoarding(job.status)) {
    return (
      <OpsShell user={user} active="dispatch">
        <Panel>
          <EmptyState
            title={
              isFinal(job.status)
                ? `${job.reference} is closed`
                : `The passenger is on board ${job.reference}`
            }
            description="From POB on, a booking keeps the driver it had. Step it back first if the driver must change."
            action={<ButtonLink href={back}>Back to the job</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const { drivers, cars } = await loadAssignmentBoard(payload, user, job, now);
  const at = new Date(job.pickupAt);
  const currentDriverId = relId(job.driver);
  const currentDriver = currentDriverId
    ? await payload.findByID({
        collection: "drivers",
        id: currentDriverId,
        depth: 0,
        user,
        overrideAccess: false,
        disableErrors: true,
      })
    : null;

  return (
    <OpsShell user={user} active="dispatch">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {job.reference}
        </Link>
      </div>
      <PageHeader
        title={job.driver ? "Change driver" : "Assign driver"}
        meta={<JobStatusBadge status={job.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Driver and car"
          description="Any driver, with any car. A different class or too few seats is a warning; a licence, MOT or insurance out of date stops it."
        >
          {drivers.length || cars.length ? (
            <AssignForm
              jobId={job.id}
              job={{ jobClass: job.vehicleClassSlug, passengers: job.passengers ?? null }}
              drivers={drivers}
              cars={cars}
              notifyPassenger={job.notifyPassenger ?? true}
              canEmailPassenger={Boolean(job.leadEmail || job.bookerEmail)}
              driverPricePence={job.driverPricePence ?? null}
              current={
                currentDriverId
                  ? {
                      driverId: currentDriverId,
                      carId: relId(job.vehicle),
                      name: currentDriver?.fullName ?? "The current driver",
                    }
                  : null
              }
              cancelHref={back}
            />
          ) : (
            <EmptyState
              title="No drivers or cars yet"
              description="Add a driver and their car under Fleet first."
            />
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="The job">
            <div className="flex flex-col gap-2">
              <p className="text-ink text-lg font-semibold tabular-nums">
                {pickupLabel(at)}{" "}
                <span className="text-ink-3 text-sm font-normal">
                  {relative(at, now)}
                </span>
              </p>
              <p className="text-ink font-medium">{job.nameBoardText || job.leadName}</p>
              <Route from={job.pickupAddress} to={job.dropoffAddress} />
              <p className="text-ink-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {job.flightNumber ? (
                  <span className="inline-flex items-center gap-1">
                    <Plane aria-hidden className="h-3.5 w-3.5" />
                    {job.flightNumber}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <UsersRound aria-hidden className="h-3.5 w-3.5" />
                  {job.passengers} · {job.largeBags} large bags
                </span>
                <span>{vehicleClassName(job.vehicleClassSlug)}</span>
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </OpsShell>
  );
}
