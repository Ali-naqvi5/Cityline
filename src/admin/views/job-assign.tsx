import { ArrowLeft, Building, Plane, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { loadAssignmentBoard, loadOperatorBoard } from "@/admin/data/dispatch";
import { pickupLabel, relative } from "@/admin/format";
import { AssignForm } from "@/admin/forms/assign-form";
import { AssignOperatorForm } from "@/admin/forms/assign-operator-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { JobStatusBadge, Route } from "@/components/ops/jobs";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { relId } from "@/domain/dispatch/assignment";
import { driverDetailsEmailsOn } from "@/lib/features";
import { vehicleClassName } from "@/domain/jobs/labels";
import { beforeBoarding, isFinal } from "@/domain/jobs/status";
import { can } from "@/domain/staff/permissions";
import type { Job } from "@/payload-types";

/**
 * Assigning a driver to a job (`/jobs/:id/assign`, spec §19): every driver,
 * each with their own car, which goes with them (Cityline, 9 Oct 2026). What
 * cannot legally go is shown with the reason. Or, with `?to=operator`, giving
 * it to a subcontracting operator (Cityline, 15 Oct 2026).
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
      <OpsShell user={user} active="bookings">
        <Panel>
          <EmptyState
            title="No job with that number"
            action={<ButtonLink href="/admin/bookings">Back to bookings</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const back = `/admin/jobs/${job.id}`;
  if (!beforeBoarding(job.status)) {
    return (
      <OpsShell user={user} active="bookings">
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

  const toOperator =
    param(props.searchParams, "to") === "operator" && can(user.role, "operators.view");
  const [drivers, operators] = await Promise.all([
    toOperator ? Promise.resolve([]) : loadAssignmentBoard(payload, user, job, now),
    toOperator ? loadOperatorBoard(payload, user, job) : Promise.resolve([]),
  ]);
  const at = new Date(job.pickupAt);
  const currentDriverId = relId(job.driver);
  const currentOperatorId = relId(job.operator);
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
  // Whoever has the booking now, by name: a driver, or an operator.
  const current = currentDriverId
    ? {
        driverId: currentDriverId,
        operatorId: null,
        name: currentDriver?.fullName ?? "The current driver",
      }
    : currentOperatorId
      ? {
          driverId: null,
          operatorId: currentOperatorId,
          name: job.subcontractorName ?? "The current operator",
        }
      : null;
  const assigned = current !== null;

  return (
    <OpsShell user={user} active="bookings">
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
        title={
          toOperator
            ? assigned
              ? "Give to an operator"
              : "Assign to an operator"
            : assigned
              ? "Change driver"
              : "Assign driver"
        }
        meta={<JobStatusBadge status={job.status} />}
        actions={
          toOperator ? (
            <ButtonLink href={`/admin/jobs/${job.id}/assign`}>
              <UserRound aria-hidden className="h-4 w-4" />
              Assign a driver instead
            </ButtonLink>
          ) : can(user.role, "operators.view") ? (
            <ButtonLink href={`/admin/jobs/${job.id}/assign?to=operator`}>
              <Building aria-hidden className="h-4 w-4" />
              Assign to an operator
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {toOperator ? (
          <Panel
            title="Subcontracting operator"
            description="Another licensed operator does the job with their own driver and car. One who has left, or whose licence has run out, cannot take it."
          >
            {operators.length ? (
              <AssignOperatorForm
                jobId={job.id}
                operators={operators}
                current={
                  current ? { operatorId: current.operatorId, name: current.name } : null
                }
                pricePence={job.driverPricePence ?? null}
                cancelHref={back}
              />
            ) : (
              <EmptyState
                title="No subcontracting operators yet"
                description="Add one under Fleet → Subcontracting Operators first."
                action={
                  can(user.role, "operators.edit") ? (
                    <ButtonLink href="/admin/operators/new">Add an operator</ButtonLink>
                  ) : undefined
                }
              />
            )}
          </Panel>
        ) : (
          <Panel
            title="Driver"
            description="Each driver comes with their own car. A different class or too few seats is a warning; a licence, MOT or insurance out of date stops it."
          >
            {drivers.length ? (
              <AssignForm
                jobId={job.id}
                job={{
                  jobClass: job.vehicleClassSlug,
                  passengers: job.passengers ?? null,
                }}
                drivers={drivers}
                notifyPassenger={job.notifyPassenger ?? true}
                canEmailPassenger={Boolean(job.leadEmail || job.bookerEmail)}
                passengerEmails={driverDetailsEmailsOn()}
                driverPricePence={job.driverPricePence ?? null}
                current={
                  current ? { driverId: current.driverId, name: current.name } : null
                }
                cancelHref={back}
              />
            ) : (
              <EmptyState
                title="No drivers yet"
                description="Add a driver and their car under Fleet first."
              />
            )}
          </Panel>
        )}

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
