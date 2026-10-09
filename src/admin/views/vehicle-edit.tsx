import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { VehicleForm, type VehicleFormValues } from "@/admin/forms/vehicle-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { VEHICLE_CLASSES } from "@/domain/pricing/vehicle-classes";

/**
 * Adding a car (`/vehicles/new`) or editing one (`/vehicles/:id/edit`): every
 * car is one driver's own, so the form asks whose.
 */
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
    select: { fullName: true, phone: true },
    user,
    overrideAccess: false,
  });
  // The car each driver uses now, to say which one a new car replaces.
  const inUse = await payload.find({
    collection: "vehicles",
    where: { status: { not_equals: "sold" } },
    pagination: false,
    depth: 0,
    select: { registration: true, drivers: true },
    user,
    overrideAccess: false,
  });
  const currentCar = new Map<number, { id: number; registration: string }>();
  for (const car of inUse.docs) {
    for (const linked of car.drivers ?? []) {
      const id = typeof linked === "object" ? linked.id : linked;
      currentCar.set(id, { id: car.id, registration: car.registration });
    }
  }

  let values: VehicleFormValues = {
    registration: "",
    make: "",
    model: "",
    colour: "",
    vehicleClassSlug: "",
    seats: "",
    status: "active",
    // "Add a car" from a driver's page comes with that driver chosen.
    driver: Number(param(props.searchParams, "driver")) || null,
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
        <OpsShell user={user} active="drivers">
          <Panel>
            <EmptyState
              title="No car with that number"
              action={<ButtonLink href="/admin/vehicles">Back to cars</ButtonLink>}
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
      status: vehicle.status,
      driver: (() => {
        const linked = (vehicle.drivers ?? [])[0];
        return linked ? (typeof linked === "object" ? linked.id : linked) : null;
      })(),
      notes: vehicle.notes ?? "",
    };
  }

  const back = isNew ? "/admin/vehicles" : `/admin/vehicles/${idSegment}`;
  return (
    <OpsShell user={user} active="drivers">
      <div className="mb-3">
        <Link
          href={back}
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {isNew ? "Cars" : values.registration}
        </Link>
      </div>
      <PageHeader
        title={isNew ? "Add a car" : "Edit car"}
        description={
          isNew
            ? "Documents are added on the car's page once it is saved. A new driver's car can also be added with the driver."
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
            phone: driver.phone,
            currentCar: currentCar.get(driver.id) ?? null,
          }))}
          cancelHref={back}
        />
      </Panel>
    </OpsShell>
  );
}
