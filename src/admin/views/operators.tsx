import { Handshake, Plus } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { param, requireStaff } from "@/admin/guard";
import { DataTable } from "@/components/ops/data-table";
import { Badge, ButtonLink, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { relId } from "@/domain/dispatch/assignment";
import { licensedFromText, operatorCheck } from "@/domain/operators/operators";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";
import type { Operator } from "@/payload-types";

/** Whether a booking could go to them today, in a word. */
export function OperatorStatus({ operator, now }: { operator: Operator; now: Date }) {
  if (operator.dateLeft && new Date(operator.dateLeft) <= now) return <Badge>Left</Badge>;
  if (operatorCheck(operator, now).blocks.length) {
    return <Badge tone="danger">Licence expired</Badge>;
  }
  return <Badge tone="ok">Active</Badge>;
}

/**
 * Subcontracting operators (Cityline, 15 Oct 2026): other licensed operators
 * Cityline passes bookings to, who do them with their own drivers and cars.
 * Those who have left are hidden unless asked for.
 */
export async function OperatorsView(props: AdminViewServerProps) {
  const context = requireStaff(props, "operators.view", "/admin/operators");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();
  const showLeft = param(props.searchParams, "left") === "1";

  const operators = await payload.find({
    collection: "operators",
    where: showLeft
      ? undefined
      : {
          or: [
            { dateLeft: { exists: false } },
            { dateLeft: { greater_than: now.toISOString() } },
          ],
        },
    sort: "name",
    pagination: false,
    depth: 0,
    user,
    overrideAccess: false,
  });

  // Bookings per operator, in one query.
  const ids = operators.docs.map((operator) => operator.id);
  const jobs = ids.length
    ? await payload.find({
        collection: "jobs",
        where: { and: [{ operator: { in: ids } }, { isTest: { not_equals: true } }] },
        pagination: false,
        depth: 0,
        select: { operator: true, status: true },
        user,
        overrideAccess: false,
      })
    : { docs: [] };
  const counts = new Map<number, { total: number; completed: number }>();
  for (const job of jobs.docs) {
    const id = relId(job.operator);
    if (!id) continue;
    const entry = counts.get(id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (job.status === "completed") entry.completed += 1;
    counts.set(id, entry);
  }

  const canEdit = can(user.role, "operators.edit");

  return (
    <OpsShell user={user} active="operators">
      <PageHeader
        title="Subcontracting operators"
        description="Licensed operators Cityline passes bookings to. They do the job with their own drivers and cars; the booking's record names the operator and their licence."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={showLeft ? "/admin/operators" : "/admin/operators?left=1"}
              variant="ghost"
            >
              {showLeft ? "Hide those who left" : "Show those who left"}
            </ButtonLink>
            {canEdit ? (
              <ButtonLink href="/admin/operators/new" variant="primary">
                <Plus aria-hidden className="h-4 w-4" />
                Add operator
              </ButtonLink>
            ) : null}
          </div>
        }
      />
      <Panel bodyClassName="p-0">
        {operators.docs.length === 0 ? (
          <EmptyState
            icon={<Handshake aria-hidden className="h-5 w-5" />}
            title="No subcontracting operators yet"
            description="Add the licensed operators you pass bookings to."
            action={
              canEdit ? (
                <ButtonLink href="/admin/operators/new" variant="primary" size="sm">
                  Add operator
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            caption="Subcontracting operators"
            rows={operators.docs as Operator[]}
            rowKey={(operator) => operator.id}
            rowHref={(operator) => `/admin/operators/${operator.id}`}
            card={(operator) => (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-ink text-base font-medium">{operator.name}</p>
                  <p className="text-ink-3 text-sm">
                    {licensedFromText(operator)} · {counts.get(operator.id)?.total ?? 0}{" "}
                    bookings
                  </p>
                </div>
                <OperatorStatus operator={operator} now={now} />
              </div>
            )}
            columns={[
              {
                key: "name",
                header: "Operator",
                cell: (operator) => (
                  <Link
                    href={`/admin/operators/${operator.id}`}
                    className="text-ink font-medium hover:underline"
                  >
                    {operator.name}
                    {operator.legalName ? (
                      <span className="text-ink-3 block text-xs font-normal">
                        {operator.legalName}
                      </span>
                    ) : null}
                  </Link>
                ),
              },
              {
                key: "licence",
                header: "Licence",
                cell: (operator) => (
                  <span className="text-ink-2">
                    {licensedFromText(operator)}
                    <span className="text-ink-3 block text-xs tabular-nums">
                      {operator.licenceNumber || "No number on record"}
                      {operator.licenceExpiresAt
                        ? ` · to ${formatDate(new Date(operator.licenceExpiresAt))}`
                        : ""}
                    </span>
                  </span>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                hideBelow: "lg",
                cell: (operator) => (
                  <span className="text-ink-2">
                    {operator.contactName || "—"}
                    <span className="text-ink-3 block text-xs tabular-nums">
                      {operator.phone}
                    </span>
                  </span>
                ),
              },
              {
                key: "bookings",
                header: "Bookings",
                align: "right",
                cell: (operator) => (
                  <span className="tabular-nums">
                    {counts.get(operator.id)?.total ?? 0}
                    <span className="text-ink-3 block text-xs">
                      {counts.get(operator.id)?.completed ?? 0} completed
                    </span>
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (operator) => <OperatorStatus operator={operator} now={now} />,
              },
            ]}
          />
        )}
      </Panel>
    </OpsShell>
  );
}
