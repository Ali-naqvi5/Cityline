import { FileClock } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps, Where } from "payload";

import { auditFieldLabel, auditValue } from "@/admin/audit-format";
import { stamp } from "@/admin/format";
import { param, requireStaff } from "@/admin/guard";
import { Pagination } from "@/components/ops/data-table";
import { FilterForm } from "@/components/ops/filter-form";
import { Label, Select, TextInput } from "@/components/ops/form-controls";
import { Badge, PageHeader, Panel, type Tone } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { Change } from "@/components/ops/timeline";
import type { FieldChange } from "@/domain/audit/diff";
import { ROLE_LABELS, isRole } from "@/domain/staff/permissions";
import type { User } from "@/payload-types";

/** Every change staff have made (ADM-04, spec §39), newest first. Owner only. */

const ENTITIES: Record<string, { label: string; route?: string }> = {
  jobs: { label: "Job", route: "jobs" },
  bookings: { label: "Booking" },
  customers: { label: "Customer" },
  drivers: { label: "Driver", route: "drivers" },
  "driver-documents": { label: "Driver document" },
  vehicles: { label: "Vehicle", route: "vehicles" },
  "vehicle-documents": { label: "Vehicle document" },
  suppliers: { label: "Supplier", route: "suppliers" },
  users: { label: "Staff account" },
};

const ACTION_TONE: Record<string, Tone> = {
  create: "ok",
  update: "info",
  delete: "danger",
};
const ACTION_LABEL: Record<string, string> = {
  create: "Created",
  update: "Changed",
  delete: "Deleted",
};
const PAGE_SIZE = 50;

export async function AuditView(props: AdminViewServerProps) {
  const context = requireStaff(props, "audit.view", "/admin/audit");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  const entity = param(props.searchParams, "entity");
  const q = param(props.searchParams, "q").slice(0, 60);
  const page = Math.max(1, Number.parseInt(param(props.searchParams, "page"), 10) || 1);

  const and: Where[] = [];
  if (entity && ENTITIES[entity]) and.push({ entity: { equals: entity } });
  if (q) and.push({ docLabel: { like: q } });

  const result = await payload.find({
    collection: "audit-log",
    where: and.length ? { and } : undefined,
    sort: "-createdAt",
    limit: PAGE_SIZE,
    page,
    depth: 1,
    user,
    overrideAccess: false,
  });

  const href = (next: number) => {
    const query = new URLSearchParams();
    if (entity) query.set("entity", entity);
    if (q) query.set("q", q);
    if (next > 1) query.set("page", String(next));
    const search = query.toString();
    return `/admin/audit${search ? `?${search}` : ""}`;
  };

  return (
    <OpsShell user={user} active="audit">
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Written by the system; it cannot be edited."
      />
      <Panel bodyClassName="p-0">
        <FilterForm
          action="/admin/audit"
          className="border-line grid gap-3 border-b p-4 sm:grid-cols-[minmax(200px,2fr)_minmax(180px,1fr)]"
        >
          <div>
            <Label htmlFor="audit-q">Record</Label>
            <TextInput
              id="audit-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Job reference, driver, registration…"
            />
          </div>
          <div>
            <Label htmlFor="audit-entity">Kind of record</Label>
            <Select id="audit-entity" name="entity" defaultValue={entity}>
              <option value="">Everything</option>
              {Object.entries(ENTITIES).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </FilterForm>

        {result.docs.length === 0 ? (
          <EmptyState
            icon={<FileClock aria-hidden className="h-5 w-5" />}
            title={
              q || entity ? "No changes match these filters" : "No changes recorded yet"
            }
            description="Every change staff make to jobs, drivers, vehicles, suppliers, bookings and staff accounts is recorded here."
          />
        ) : (
          <ol className="divide-line divide-y">
            {result.docs.map((row) => {
              const actor =
                typeof row.user === "object" ? (row.user as User | null) : null;
              const changes = (
                (Array.isArray(row.changes) ? row.changes : []) as FieldChange[]
              )
                .map((change) => ({
                  field: change.field,
                  from: auditValue(change.field, change.from),
                  to: auditValue(change.field, change.to),
                }))
                .filter((change) => change.from !== change.to);
              const info = ENTITIES[row.entity];
              const link = info?.route ? `/admin/${info.route}/${row.docId}` : null;
              return (
                <li
                  key={row.id}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[180px_minmax(0,1fr)]"
                >
                  <div className="text-xs">
                    <time
                      dateTime={row.createdAt}
                      className="text-ink-2 block font-medium tabular-nums"
                    >
                      {stamp(new Date(row.createdAt))}
                    </time>
                    <span className="text-ink-3 block">
                      {actor?.name || actor?.email || "Staff"}
                      {row.role && isRole(row.role) ? ` · ${ROLE_LABELS[row.role]}` : ""}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={ACTION_TONE[row.action] ?? "neutral"}>
                        {ACTION_LABEL[row.action] ?? row.action}
                      </Badge>
                      <span className="text-ink-3">{info?.label ?? row.entity}</span>
                      {link ? (
                        <Link
                          href={link}
                          className="text-ink font-medium hover:underline"
                        >
                          {row.docLabel}
                        </Link>
                      ) : (
                        <span className="text-ink font-medium">{row.docLabel}</span>
                      )}
                    </p>
                    {changes.length ? (
                      <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                        {changes.slice(0, 6).map((change) => (
                          <li
                            key={change.field}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span className="text-ink-3 w-36 shrink-0 text-xs">
                              {auditFieldLabel(change.field)}
                            </span>
                            <Change
                              from={change.from ?? undefined}
                              to={change.to ?? undefined}
                            />
                          </li>
                        ))}
                        {changes.length > 6 ? (
                          <li className="text-ink-3 text-xs">
                            and {changes.length - 6} more fields
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <Pagination
          page={page}
          totalPages={result.totalPages}
          totalDocs={result.totalDocs}
          pageSize={PAGE_SIZE}
          hrefFor={href}
        />
      </Panel>
    </OpsShell>
  );
}
