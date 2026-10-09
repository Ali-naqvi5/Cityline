import { Plus, Search, UserPlus, UserRound } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps, Where } from "payload";

import { FleetTabs } from "@/admin/components/fleet-tabs";
import { loadDrivers, type DriverRecord } from "@/admin/data/fleet";
import { pickupLabel } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import { ComplianceBadge, DRIVER_STATUS_TONE } from "@/components/ops/compliance";
import { DataTable } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Label, Select, TextInput } from "@/components/ops/form-controls";
import { Badge, ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { isBlocking } from "@/domain/compliance/documents";
import { DRIVER_STATUS_LABELS } from "@/domain/fleet/labels";
import { can } from "@/domain/staff/permissions";

/** Drivers (spec §20): who they are, whether they can work, their next job. */

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function complianceFilter(record: DriverRecord, value: string): boolean {
  if (value === "blocked") return isBlocking(record.worst);
  if (value === "expiring") return record.worst.startsWith("expiring");
  if (value === "ok") return record.worst === "valid";
  return true;
}

export async function DriversView(props: AdminViewServerProps) {
  const context = requireStaff(props, "drivers.view", "/admin/drivers");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const status = param(props.searchParams, "status") || "current";
  const compliance = param(props.searchParams, "compliance");
  const type = param(props.searchParams, "type");
  const q = param(props.searchParams, "q").slice(0, 60);

  const and: Where[] = [];
  if (status === "current") and.push({ status: { not_equals: "left" } });
  else if (["active", "suspended", "left"].includes(status))
    and.push({ status: { equals: status } });
  if (type === "registered" || type === "outsourced") {
    and.push({ engagement: { equals: type } });
  }
  if (q) {
    const digits = q.replace(/\D/g, "").replace(/^44/, "").replace(/^0+/, "");
    // Drivers of a car whose registration, make or model matches.
    const byCar = can(user.role, "vehicles.view")
      ? (
          await payload.find({
            collection: "vehicles",
            where: {
              or: [
                { registration: { like: q.replace(/\s+/g, "").toUpperCase() } },
                { make: { like: q } },
                { model: { like: q } },
              ],
            },
            pagination: false,
            depth: 0,
            select: { drivers: true },
            user,
            overrideAccess: false,
          })
        ).docs.flatMap((car) =>
          (car.drivers ?? []).map((linked) =>
            typeof linked === "object" ? linked.id : linked,
          ),
        )
      : [];
    and.push({
      or: [
        { fullName: { like: q } },
        ...(digits.length >= 6 ? [{ phone: { like: digits } }] : []),
        ...(byCar.length ? [{ id: { in: byCar } }] : []),
      ],
    });
  }

  const records = (
    await loadDrivers(payload, user, now, and.length ? { and } : undefined)
  ).filter((record) => complianceFilter(record, compliance));
  const canEdit = can(user.role, "drivers.edit");
  const seesCars = can(user.role, "vehicles.view");
  // Each driver's cars, for those who may see cars.
  const carsOf = new Map<number, string[]>();
  if (seesCars && records.length) {
    const cars = await payload.find({
      collection: "vehicles",
      where: {
        and: [
          { status: { not_equals: "sold" } },
          { drivers: { in: records.map(({ driver }) => driver.id) } },
        ],
      },
      pagination: false,
      depth: 0,
      user,
      overrideAccess: false,
    });
    for (const car of cars.docs) {
      for (const linked of car.drivers ?? []) {
        const id = typeof linked === "object" ? linked.id : linked;
        carsOf.set(id, [
          ...(carsOf.get(id) ?? []),
          `${car.registration} · ${car.make} ${car.model}`,
        ]);
      }
    }
  }

  return (
    <OpsShell user={user} active="drivers">
      <PageHeader
        title="Drivers & cars"
        description="Independent drivers, each with their own car, and whether their documents let them work."
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/drivers/new?engagement=outsourced">
                <UserPlus aria-hidden className="h-4 w-4" />
                Add outsourced driver
              </ButtonLink>
              <ButtonLink href="/admin/drivers/new" variant="primary">
                <Plus aria-hidden className="h-4 w-4" />
                Add driver
              </ButtonLink>
            </div>
          ) : null
        }
      />

      <FleetTabs active="drivers" showCars={seesCars} />
      <Panel bodyClassName="p-0">
        <FilterForm
          action="/admin/drivers"
          className="border-line grid gap-3 border-b p-4 sm:grid-cols-[minmax(200px,2fr)_repeat(3,minmax(150px,1fr))]"
        >
          <div>
            <Label htmlFor="drivers-q">Search</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="text-ink-4 pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
              />
              <TextInput
                id="drivers-q"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Name, phone or car"
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="drivers-status">Status</Label>
            <Select id="drivers-status" name="status" defaultValue={status}>
              <option value="current">Active and suspended</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="left">Left</option>
              <option value="all">Everyone</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="drivers-type">Type</Label>
            <Select id="drivers-type" name="type" defaultValue={type}>
              <option value="">Any type</option>
              <option value="registered">Registered</option>
              <option value="outsourced">Outsourced</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="drivers-compliance">Compliance</Label>
            <Select id="drivers-compliance" name="compliance" defaultValue={compliance}>
              <option value="">Any</option>
              <option value="blocked">Assignment blocked</option>
              <option value="expiring">Expiring soon</option>
              <option value="ok">Compliant</option>
            </Select>
          </div>
        </FilterForm>

        {records.length === 0 ? (
          <EmptyState
            icon={<UserRound aria-hidden className="h-5 w-5" />}
            title={
              q || compliance || type || status !== "current"
                ? "No drivers currently match these filters"
                : "No drivers yet"
            }
            description={
              q || compliance
                ? "Try a different search, or clear the filters."
                : "Add each driver with their licence and documents. Only compliant drivers can be given jobs."
            }
            action={
              canEdit && !q && !compliance ? (
                <ButtonLink href="/admin/drivers/new" variant="primary" size="sm">
                  Add driver
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            caption="Drivers"
            rows={records}
            rowKey={(record) => record.driver.id}
            rowHref={(record) => `/admin/drivers/${record.driver.id}`}
            card={({ driver, worst, nextJob }) => (
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="bg-sunken text-ink-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                >
                  {initials(driver.fullName ?? "")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-ink text-base font-medium">
                      {driver.fullName}
                      {driver.engagement === "outsourced" ? (
                        <Badge tone="special" className="ml-2 align-middle">
                          Outsourced
                        </Badge>
                      ) : null}
                    </p>
                    <Badge tone={DRIVER_STATUS_TONE[driver.status]}>
                      {DRIVER_STATUS_LABELS[driver.status]}
                    </Badge>
                  </div>
                  <p className="text-ink-3 text-sm tabular-nums">{driver.phone}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {driver.engagement === "outsourced" ? (
                      <Badge tone="neutral">Kept offline</Badge>
                    ) : (
                      <ComplianceBadge worst={worst} />
                    )}
                    <span className="text-ink-3 text-xs">
                      {nextJob
                        ? `Next: ${pickupLabel(new Date(nextJob.pickupAt))}`
                        : "No jobs booked"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            columns={[
              {
                key: "name",
                header: "Driver",
                cell: ({ driver }) => (
                  <Link
                    href={`/admin/drivers/${driver.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <span
                      aria-hidden
                      className="bg-sunken text-ink-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    >
                      {initials(driver.fullName ?? "")}
                    </span>
                    <span className="text-ink font-medium">{driver.fullName}</span>
                    {driver.engagement === "outsourced" ? (
                      <Badge tone="special">Outsourced</Badge>
                    ) : null}
                  </Link>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: ({ driver }) => (
                  <Badge tone={DRIVER_STATUS_TONE[driver.status]}>
                    {DRIVER_STATUS_LABELS[driver.status]}
                  </Badge>
                ),
              },
              ...(seesCars
                ? [
                    {
                      key: "cars",
                      header: "Car",
                      cell: ({ driver }: DriverRecord) =>
                        carsOf.get(driver.id)?.length ? (
                          <span className="text-ink-2 text-sm">
                            {carsOf.get(driver.id)!.map((car) => (
                              <span
                                key={car}
                                className="block whitespace-nowrap tabular-nums"
                              >
                                {car}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-ink-4">No car linked</span>
                        ),
                    },
                  ]
                : []),
              {
                key: "phone",
                header: "Phone",
                cell: ({ driver }) => (
                  <span className="text-ink-2 whitespace-nowrap tabular-nums">
                    {driver.phone}
                  </span>
                ),
              },
              {
                key: "whatsapp",
                header: "WhatsApp",
                hideBelow: "xl",
                cell: ({ driver }) =>
                  driver.whatsappConsentAt ? (
                    <span className="text-ink-2">Agreed</span>
                  ) : (
                    <span className="text-ink-4">Not agreed</span>
                  ),
              },
              {
                key: "compliance",
                header: "Compliance",
                // An outsourced driver is never checked: records kept offline.
                cell: ({ driver, worst }) =>
                  driver.engagement === "outsourced" ? (
                    <Badge tone="neutral">Kept offline</Badge>
                  ) : (
                    <ComplianceBadge worst={worst} />
                  ),
              },
              {
                key: "next",
                header: "Next job",
                hideBelow: "lg",
                cell: ({ nextJob }) =>
                  nextJob ? (
                    <Link
                      href={`/admin/jobs/${nextJob.id}`}
                      className="text-ink-2 whitespace-nowrap hover:underline"
                    >
                      {pickupLabel(new Date(nextJob.pickupAt))}
                      <span className="text-ink-3 block text-xs">
                        {nextJob.reference}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-ink-4">None booked</span>
                  ),
              },
            ]}
          />
        )}
      </Panel>
    </OpsShell>
  );
}
