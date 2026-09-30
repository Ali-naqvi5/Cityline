import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { VehicleForm, type VehicleFormValues } from "@/admin/forms/vehicle-form";
import { requireStaff, segment } from "@/admin/guard";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/** Adding a vehicle (`/vehicles/new`) or editing one (`/vehicles/:id/edit`). */
export async function VehicleEditView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const isNew = idSegment === "new";
  const context = requireStaff(
    props,
    "vehicles.edit",
    isNew ? "/admin/vehicles/new" : `/admin/vehicles/${idSegment}/edit`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  const drivers = await payload.find({
    collection: "drivers",
    where: { status: { not_equals: "left" } },
    sort: "fullName",
    pagination: false,
    depth: 0,
    select: { fullName: true },
    user,
    overrideAccess: false,
  });

  let values: VehicleFormValues = {
    registration: "",
    make: "",
    model: "",
    colour: "",
    vehicleClassSlug: "",
    seats: "",
    ownership: "driver",
    status: "active",
    drivers: [],
    notes: "",
  };

  if (!isNew) {
    const vehicle = await payload.findByID({
      collection: "vehicles",
      id: Number(idSegment),
      depth: 0,
      user,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!vehicle) {
      return (
        <OpsShell user={user} active="vehicles">
          <Panel>
            <EmptyState
              title="No vehicle with that number"
              action={<ButtonLink href="/admin/vehicles">Back to vehicles</ButtonLink>}
            />
          </Panel>
        </OpsShell>
      );
    }
    values = {
      id: vehicle.id,
      registration: vehicle.registration,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      vehicleClassSlug: vehicle.vehicleClassSlug,
      seats: vehicle.seats ? String(vehicle.seats) : "",
      ownership: vehicle.ownership,
      status: vehicle.status,
      drivers: (vehicle.drivers ?? []).map((driver) =>
        typeof driver === "object" ? driver.id : driver,
      ),
      notes: vehicle.notes ?? "",
    };
  }

  const back = isNew ? "/admin/vehicles" : `/admin/vehicles/${idSegment}`;
  return (
    <OpsShell user={user} active="vehicles">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {isNew ? "Vehicles" : values.registration}
        </Link>
      </div>
      <PageHeader
        title={isNew ? "Add a vehicle" : "Edit vehicle"}
        description={
          isNew
            ? "Documents are added on the vehicle's page once it is saved."
            : undefined
        }
      />
      <Panel bodyClassName="p-5">
        <VehicleForm
          values={values}
          classes={VEHICLE_CLASSES.map((vehicle) => ({
            value: vehicle.slug,
            label: vehicle.name,
          }))}
          drivers={drivers.docs.map((driver) => ({
            id: driver.id,
            name: driver.fullName ?? `Driver ${driver.id}`,
          }))}
          cancelHref={back}
        />
      </Panel>
    </OpsShell>
  );
}
