import { Building2, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { param, requireStaff } from "@/admin/guard";
import { DataTable } from "@/components/ops/data-table";
import { Badge, ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { can } from "@/domain/staff/permissions";

/** Suppliers (spec §26): the partner platforms that send Cityline work. */
export async function SuppliersView(props: AdminViewServerProps) {
  const context = requireStaff(props, "suppliers.view", "/admin/suppliers");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const showInactive = param(props.searchParams, "inactive") === "1";

  const suppliers = await payload.find({
    collection: "suppliers",
    where: showInactive ? undefined : { active: { equals: true } },
    sort: "name",
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  });

  // Job counts per supplier, in one query.
  const ids = suppliers.docs.map((supplier) => supplier.id);
  const jobs = ids.length
    ? await payload.find({
        collection: "jobs",
        where: { and: [{ supplier: { in: ids } }, { isTest: { not_equals: true } }] },
        pagination: false,
        depth: 0,
        select: { supplier: true, status: true },
        user,
        overrideAccess: false,
      })
    : { docs: [] };
  const counts = new Map<number, { total: number; completed: number }>();
  for (const job of jobs.docs) {
    const id = typeof job.supplier === "object" ? job.supplier?.id : job.supplier;
    if (!id) continue;
    const entry = counts.get(id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (job.status === "completed") entry.completed += 1;
    counts.set(id, entry);
  }

  const canEdit = can(user.role, "suppliers.edit");

  return (
    <OpsShell user={user} active="suppliers">
      <PageHeader
        title="Suppliers"
        description="Partner platforms that send jobs, and the commission each keeps."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={showInactive ? "/admin/suppliers" : "/admin/suppliers?inactive=1"}
              variant="ghost"
            >
              {showInactive ? "Hide inactive" : "Show inactive"}
            </ButtonLink>
            {canEdit ? (
              <ButtonLink href="/admin/suppliers/new" variant="primary">
                <Plus aria-hidden className="h-4 w-4" />
                Add supplier
              </ButtonLink>
            ) : null}
          </div>
        }
      />
      <Panel bodyClassName="p-0">
        {suppliers.docs.length === 0 ? (
          <EmptyState
            icon={<Building2 aria-hidden className="h-5 w-5" />}
            title="No suppliers yet"
            description="Add Trip.com and any other platform that sends you jobs, with the commission each keeps."
            action={
              canEdit ? (
                <ButtonLink href="/admin/suppliers/new" variant="primary" size="sm">
                  Add supplier
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            caption="Suppliers"
            rows={suppliers.docs}
            rowKey={(supplier) => supplier.id}
            rowHref={(supplier) => `/admin/suppliers/${supplier.id}`}
            card={(supplier) => (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-ink text-base font-medium">{supplier.name}</p>
                  <p className="text-ink-3 text-sm">
                    {supplier.defaultCommissionBp / 100}% commission ·{" "}
                    {counts.get(supplier.id)?.total ?? 0} jobs
                  </p>
                </div>
                {supplier.active ? null : <Badge>Inactive</Badge>}
              </div>
            )}
            columns={[
              {
                key: "name",
                header: "Supplier",
                cell: (supplier) => (
                  <Link
                    href={`/admin/suppliers/${supplier.id}`}
                    className="text-ink font-medium hover:underline"
                  >
                    {supplier.name}
                  </Link>
                ),
              },
              {
                key: "commission",
                header: "Default commission",
                cell: (supplier) => (
                  <span className="tabular-nums">
                    {supplier.defaultCommissionBp / 100}%
                  </span>
                ),
              },
              {
                key: "terms",
                header: "Payment terms",
                hideBelow: "lg",
                cell: (supplier) =>
                  supplier.paymentTermsDays ? `${supplier.paymentTermsDays} days` : "—",
              },
              {
                key: "jobs",
                header: "Jobs",
                align: "right",
                cell: (supplier) => (
                  <span className="tabular-nums">
                    {counts.get(supplier.id)?.total ?? 0}
                    <span className="text-ink-3 block text-xs">
                      {counts.get(supplier.id)?.completed ?? 0} completed
                    </span>
                  </span>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                hideBelow: "xl",
                cell: (supplier) => (
                  <span className="text-ink-2">
                    {supplier.contactName || "—"}
                    {supplier.email ? (
                      <span className="text-ink-3 block text-xs">{supplier.email}</span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "dashboard",
                header: "Dashboard",
                hideBelow: "lg",
                cell: (supplier) =>
                  supplier.dashboardUrl ? (
                    <a
                      href={supplier.dashboardUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent inline-flex items-center gap-1 hover:underline"
                    >
                      Open <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-ink-4">—</span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                cell: (supplier) =>
                  supplier.active ? (
                    <Badge tone="ok">Active</Badge>
                  ) : (
                    <Badge>Inactive</Badge>
                  ),
              },
            ]}
          />
        )}
      </Panel>
    </OpsShell>
  );
}
