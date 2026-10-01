import { ArrowLeft, Plane, UsersRound } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { loadAssignmentOptions } from "@/admin/data/dispatch";
import { pickupLabel, relative } from "@/admin/format";
import { AssignForm, type AssignChoice } from "@/admin/forms/assign-form";
import { requireStaff, segment } from "@/admin/guard";
import { JobStatusBadge, Route } from "@/components/ops/jobs";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { vehicleClassName } from "@/domain/jobs/labels";
import { isFinal } from "@/domain/jobs/status";
import type { Job } from "@/payload-types";

/**
 * Assigning a driver and vehicle to a job (`/jobs/:id/assign`, spec §19):
 * the eligible pairs first, then everyone who cannot take it, and why.
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
  if (isFinal(job.status)) {
    return (
      <OpsShell user={user} active="dispatch">
        <Panel>
          <EmptyState
            title={`${job.reference} is closed`}
            description="Completed, no-show and cancelled jobs keep the driver they had."
            action={<ButtonLink href={back}>Back to the job</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const { options, unavailable } = await loadAssignmentOptions(payload, user, job, now);
  const choices: AssignChoice[] = options.map((option) => ({
    pair: `${option.driver.id}:${option.vehicle.id}`,
    driverName: option.driver.fullName ?? `Driver ${option.driver.id}`,
    vehicle: `${option.vehicle.colour} ${option.vehicle.make} ${option.vehicle.model}`,
    registration: option.vehicle.registration,
    vehicleClass: vehicleClassName(option.vehicle.vehicleClassSlug),
    upgrade: option.fit === "upgrade",
    warnings: option.eligibility.warnings,
    current: option.current,
  }));
  const at = new Date(job.pickupAt);

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
          title="Eligible drivers"
          description="Active, with every document valid at the pickup time, and a vehicle that can do the job."
        >
          {choices.length ? (
            <AssignForm
              jobId={job.id}
              choices={choices}
              notifyPassenger={job.notifyPassenger ?? true}
              canEmailPassenger={Boolean(job.leadEmail || job.bookerEmail)}
              cancelHref={back}
            />
          ) : (
            <EmptyState
              title="No driver can take this job"
              description="Nobody has a valid set of documents and a suitable vehicle for this pickup. The reasons are listed beside each driver."
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

          {unavailable.length ? (
            <Panel
              title="Not available"
              description={`${unavailable.length} ${unavailable.length === 1 ? "driver" : "drivers"} cannot take this job`}
            >
              <details>
                <summary className="text-accent cursor-pointer text-sm font-medium">
                  Show who, and why
                </summary>
                <ul className="divide-line mt-3 flex flex-col divide-y">
                  {unavailable.map(({ driver, reasons }) => (
                    <li key={driver.id} className="py-2">
                      <Link
                        href={`/admin/drivers/${driver.id}`}
                        className="text-ink text-sm font-medium hover:underline"
                      >
                        {driver.fullName}
                      </Link>
                      <ul className="text-ink-3 mt-0.5 text-sm">
                        {reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            </Panel>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
