import { Car, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps, Where } from "payload";

import { loadVehicles } from "@/admin/data/fleet";
import { param, requireStaff } from "@/admin/guard";
import { ComplianceBadge, VEHICLE_STATUS_TONE } from "@/components/ops/compliance";
import { DataTable } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Label, Select, TextInput } from "@/components/ops/form-controls";
import { Badge, ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { isBlocking } from "@/domain/compliance/documents";
import { OWNERSHIP_LABELS, VEHICLE_STATUS_LABELS } from "@/domain/fleet/labels";
import { vehicleClassName } from "@/domain/jobs/labels";
import { can } from "@/domain/staff/permissions";
import type { Driver } from "@/payload-types";

/** Vehicles (spec §23): what is on the road, what class, whether it can work. */

function driverNames(drivers: unknown): string {
  if (!Array.isArray(drivers)) return "";
  return drivers
    .map((driver) =>
      driver && typeof driver === "object" ? (driver as Driver).fullName : null,
    )
    .filter(Boolean)
    .join(", ");
}

export async function VehiclesView(props: AdminViewServerProps) {
  const context = requireStaff(props, "vehicles.view", "/admin/vehicles");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const status = param(props.searchParams, "status") || "current";
  const compliance = param(props.searchParams, "compliance");
  const q = param(props.searchParams, "q").slice(0, 40);

  const and: Where[] = [];
  if (status === "current") and.push({ status: { not_equals: "sold" } });
  else if (["active", "off_road", "sold"].includes(status))
    and.push({ status: { equals: status } });
  if (q) {
    and.push({
      or: [
        { registration: { like: q.replace(/\s+/g, "").toUpperCase() } },
        { make: { like: q } },
        { model: { like: q } },
      ],
    });
  }

  const records = (
    await loadVehicles(payload, user, now, and.length ? { and } : undefined)
  ).filter((record) => {
    if (compliance === "blocked") return isBlocking(record.worst);
    if (compliance === "expiring") return record.worst.startsWith("expiring");
    if (compliance === "ok") return record.worst === "valid";
    return true;
  });
  const canEdit = can(user.role, "vehicles.edit");

  return (
    <OpsShell user={user} active="vehicles">
      <PageHeader
        title="Vehicles"
        description="Every vehicle on the fleet, its class and its documents."
        actions={
          canEdit ? (
            <ButtonLink href="/admin/vehicles/new" variant="primary">
              <Plus aria-hidden className="h-4 w-4" />
              Add vehicle
            </ButtonLink>
          ) : null
        }
      />

      <Panel bodyClassName="p-0">
        <FilterForm
          action="/admin/vehicles"
          className="border-line grid gap-3 border-b p-4 sm:grid-cols-[minmax(200px,2fr)_repeat(2,minmax(150px,1fr))]"
        >
          <div>
            <Label htmlFor="vehicles-q">Search</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="text-ink-4 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              />
              <TextInput
                id="vehicles-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Registration, make or model"
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="vehicles-status">Status</Label>
            <Select id="vehicles-status" name="status" defaultValue={status}>
              <option value="current">Active and off the road</option>
              <option value="active">Active</option>
              <option value="off_road">Off the road</option>
              <option value="sold">Sold or returned</option>
              <option value="all">Every vehicle</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="vehicles-compliance">Compliance</Label>
            <Select id="vehicles-compliance" name="compliance" defaultValue={compliance}>
              <option value="">Any</option>
              <option value="blocked">Assignment blocked</option>
              <option value="expiring">Expiring soon</option>
              <option value="ok">Compliant</option>
            </Select>
          </div>
        </FilterForm>

        {records.length === 0 ? (
          <EmptyState
            icon={<Car aria-hidden className="h-5 w-5" />}
            title={
              q || compliance || status !== "current"
                ? "No vehicles match these filters"
                : "No vehicles yet"
            }
            description={
              q || compliance
                ? "Try a different search, or clear the filters."
                : "Add each vehicle with its PHV licence, MOT and insurance."
            }
            action={
              canEdit && !q && !compliance ? (
                <ButtonLink href="/admin/vehicles/new" variant="primary" size="sm">
                  Add vehicle
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            caption="Vehicles"
            rows={records}
            rowKey={(record) => record.vehicle.id}
            rowHref={(record) => `/admin/vehicles/${record.vehicle.id}`}
            card={({ vehicle, worst }) => (
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-ink text-lg font-semibold tabular-nums">
                    {vehicle.registration}
                  </p>
                  <Badge tone={VEHICLE_STATUS_TONE[vehicle.status]}>
                    {VEHICLE_STATUS_LABELS[vehicle.status]}
                  </Badge>
                </div>
                <p className="text-ink-2 text-sm">
                  {vehicle.colour} {vehicle.make} {vehicle.model} ·{" "}
                  {vehicleClassName(vehicle.vehicleClassSlug)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <ComplianceBadge worst={worst} />
                  <span className="text-ink-3 text-xs">
                    {driverNames(vehicle.drivers) || "No driver linked"}
                  </span>
                </div>
              </div>
            )}
            columns={[
              {
                key: "registration",
                header: "Registration",
                cell: ({ vehicle }) => (
                  <Link
                    href={`/admin/vehicles/${vehicle.id}`}
                    className="text-ink font-semibold tabular-nums hover:underline"
                  >
                    {vehicle.registration}
                  </Link>
                ),
              },
              {
                key: "vehicle",
                header: "Vehicle",
                cell: ({ vehicle }) => (
                  <span className="text-ink-2">
                    {vehicle.make} {vehicle.model}
                    <span className="text-ink-3 block text-xs">{vehicle.colour}</span>
                  </span>
                ),
              },
              {
                key: "class",
                header: "Class",
                cell: ({ vehicle }) => (
                  <span className="text-ink-2 whitespace-nowrap">
                    {vehicleClassName(vehicle.vehicleClassSlug)}
                    {vehicle.seats ? (
                      <span className="text-ink-3 block text-xs">
                        {vehicle.seats} seats
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "ownership",
                header: "Ownership",
                hideBelow: "xl",
                cell: ({ vehicle }) => (
                  <span className="text-ink-2">
                    {OWNERSHIP_LABELS[vehicle.ownership]}
                  </span>
                ),
              },
              {
                key: "drivers",
                header: "Driver",
                hideBelow: "lg",
                cell: ({ vehicle }) => (
                  <span className="text-ink-2">
                    {driverNames(vehicle.drivers) || (
                      <span className="text-ink-4">None linked</span>
                    )}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: ({ vehicle }) => (
                  <Badge tone={VEHICLE_STATUS_TONE[vehicle.status]}>
                    {VEHICLE_STATUS_LABELS[vehicle.status]}
                  </Badge>
                ),
              },
              {
                key: "compliance",
                header: "Compliance",
                cell: ({ worst }) => <ComplianceBadge worst={worst} />,
              },
            ]}
          />
        )}
      </Panel>
    </OpsShell>
  );
}
