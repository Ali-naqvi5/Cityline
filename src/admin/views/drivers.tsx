import { Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps, Where } from "payload";

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
import { DRIVER_STATUS_LABELS, EMPLOYMENT_LABELS } from "@/domain/fleet/labels";
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
  const q = param(props.searchParams, "q").slice(0, 60);

  const and: Where[] = [];
  if (status === "current") and.push({ status: { not_equals: "left" } });
  else if (["active", "suspended", "left"].includes(status))
    and.push({ status: { equals: status } });
  if (q) {
    const digits = q.replace(/\D/g, "").replace(/^44/, "").replace(/^0+/, "");
    and.push({
      or: [
        { fullName: { like: q } },
        ...(digits.length >= 6 ? [{ phone: { like: digits } }] : []),
      ],
    });
  }

  const records = (
    await loadDrivers(payload, user, now, and.length ? { and } : undefined)
  ).filter((record) => complianceFilter(record, compliance));
  const canEdit = can(user.role, "drivers.edit");

  return (
    <OpsShell user={user} active="drivers">
      <PageHeader
        title="Drivers"
        description="Who can work, and whether their documents let them."
        actions={
          canEdit ? (
            <ButtonLink href="/admin/drivers/new" variant="primary">
              <Plus aria-hidden className="h-4 w-4" />
              Add driver
            </ButtonLink>
          ) : null
        }
      />

      <Panel bodyClassName="p-0">
        <FilterForm
          action="/admin/drivers"
          className="border-line grid gap-3 border-b p-4 sm:grid-cols-[minmax(200px,2fr)_repeat(2,minmax(150px,1fr))]"
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
                placeholder="Name or phone"
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
              q || compliance || status !== "current"
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
                    <p className="text-ink text-base font-medium">{driver.fullName}</p>
                    <Badge tone={DRIVER_STATUS_TONE[driver.status]}>
                      {DRIVER_STATUS_LABELS[driver.status]}
                    </Badge>
                  </div>
                  <p className="text-ink-3 text-sm tabular-nums">{driver.phone}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ComplianceBadge worst={worst} />
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
                key: "employment",
                header: "Employment",
                hideBelow: "xl",
                cell: ({ driver }) => (
                  <span className="text-ink-2">
                    {EMPLOYMENT_LABELS[driver.employmentType]}
                  </span>
                ),
              },
              {
                key: "compliance",
                header: "Compliance",
                cell: ({ worst }) => <ComplianceBadge worst={worst} />,
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
