import { ArrowLeft, ExternalLink, Info, Pencil } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { money, pickupLabel } from "@/admin/format";
import { param, requireStaff, segment } from "@/admin/guard";
import { JobStatusBadge } from "@/components/ops/jobs";
import {
  Badge,
  ButtonLink,
  Field,
  Fields,
  MetricCard,
  Notice,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { can } from "@/domain/staff/permissions";

const NOTICES: Record<string, string> = {
  created: "Supplier added. Their jobs can now be entered with the supplier's reference.",
  saved: "Changes saved. A new commission applies to jobs entered from now on.",
};

export async function SupplierView(props: AdminViewServerProps) {
  const id = Number(segment(props, 1));
  const context = requireStaff(
    props,
    "suppliers.view",
    `/admin/suppliers/${segment(props, 1)}`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;

  const supplier = Number.isInteger(id)
    ? await payload.findByID({
        collection: "suppliers",
        id,
        depth: 0,
        user,
        overrideAccess: false,
        disableErrors: true,
      })
    : null;
  if (!supplier) {
    return (
      <OpsShell user={user} active="suppliers">
        <Panel>
          <EmptyState
            title="No supplier with that number"
            action={<ButtonLink href="/admin/suppliers">Back to suppliers</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const [recent, total, completed] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: { and: [{ supplier: { equals: id } }, { isTest: { not_equals: true } }] },
      sort: "-pickupAt",
      limit: 15,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: "jobs",
      where: { and: [{ supplier: { equals: id } }, { isTest: { not_equals: true } }] },
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: "jobs",
      where: {
        and: [
          { supplier: { equals: id } },
          { status: { equals: "completed" } },
          { isTest: { not_equals: true } },
        ],
      },
      user,
      overrideAccess: false,
    }),
  ]);

  const notice = NOTICES[param(props.searchParams, "notice")];

  return (
    <OpsShell user={user} active="suppliers">
      <div className="mb-3">
        <Link
          href="/admin/suppliers"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Suppliers
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <PageHeader
        eyebrow="Supplier"
        title={supplier.name}
        meta={supplier.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            {supplier.dashboardUrl ? (
              <ButtonLink href={supplier.dashboardUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden className="h-4 w-4" />
                Supplier dashboard
              </ButtonLink>
            ) : null}
            {can(user.role, "suppliers.edit") ? (
              <ButtonLink href={`/admin/suppliers/${supplier.id}/edit`}>
                <Pencil aria-hidden className="h-4 w-4" />
                Edit
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Default commission"
          value={`${supplier.defaultCommissionBp / 100}%`}
        />
        <MetricCard label="Jobs" value={total.totalDocs} />
        <MetricCard label="Completed" value={completed.totalDocs} />
        <MetricCard
          label="Payment terms"
          value={supplier.paymentTermsDays ? `${supplier.paymentTermsDays} d` : "—"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Recent jobs" bodyClassName="p-0">
            {recent.docs.length === 0 ? (
              <EmptyState title="No jobs from this supplier yet" />
            ) : (
              <ul className="divide-line divide-y">
                {recent.docs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="hover:bg-sunken/60 flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="text-ink block text-sm font-medium tabular-nums">
                          {pickupLabel(new Date(job.pickupAt))}
                        </span>
                        <span className="text-ink-3 block truncate text-xs">
                          {job.reference}
                          {job.supplierReference
                            ? ` · ${job.supplierReference}`
                            : ""} · {money(job.customerPricePence)}
                        </span>
                      </span>
                      <JobStatusBadge status={job.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <p className="text-ink-3 flex items-start gap-2 text-xs">
            <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Money owed, payments received and the outstanding balance appear here once
            supplier payments are recorded in Finance.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Contact">
            <Fields className="sm:grid-cols-1">
              <Field label="Name">{supplier.contactName || "—"}</Field>
              <Field label="Email">
                {supplier.email ? (
                  <a
                    href={`mailto:${supplier.email}`}
                    className="text-accent hover:underline"
                  >
                    {supplier.email}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Phone">{supplier.phone || "—"}</Field>
            </Fields>
          </Panel>
          {supplier.notes ? (
            <Panel title="Notes">
              <p className="text-ink-2 text-sm whitespace-pre-line">{supplier.notes}</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
