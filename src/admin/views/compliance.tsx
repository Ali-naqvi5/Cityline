import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { loadComplianceItems, type ComplianceItem } from "@/admin/data/fleet";
import { param, requireStaff } from "@/admin/guard";
import { DocumentStatusBadge } from "@/components/ops/compliance";
import { cx, MetricCard, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import {
  DOCUMENT_LABELS,
  isBlocking,
  type DocumentStatus,
  type DocumentType,
} from "@/domain/compliance/documents";
import { formatDate } from "@/lib/time";

/**
 * Compliance across the fleet (spec §24, §25, DOC-01): what is expired or
 * missing (and so blocks assignment), what expires within 7, 14 and 30 days.
 */

const BANDS: { status: DocumentStatus; label: string }[] = [
  { status: "missing", label: "Missing" },
  { status: "expired", label: "Expired" },
  { status: "expiring_7", label: "Within 7 days" },
  { status: "expiring_14", label: "Within 14 days" },
  { status: "expiring_30", label: "Within 30 days" },
  { status: "valid", label: "Valid" },
];

function AttentionList({ items, now }: { items: ComplianceItem[]; now: Date }) {
  const attention = items.filter((item) => item.status !== "valid");
  if (attention.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck aria-hidden className="h-5 w-5" />}
        title={
          items.length === 0 ? "Nothing on record yet" : "All documents are compliant"
        }
        description={
          items.length === 0
            ? "Add drivers and vehicles with their documents to see them here."
            : "Nothing expires in the next 30 days."
        }
      />
    );
  }
  return (
    <ul className="divide-line divide-y">
      {attention.map((item) => (
        <li key={`${item.kind}-${item.ownerId}-${item.type}`}>
          <Link
            href={`/admin/${item.kind}s/${item.ownerId}`}
            className={cx(
              "hover:bg-sunken/60 flex flex-col gap-2 border-l-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
              isBlocking(item.status)
                ? "border-l-danger"
                : item.status === "expiring_7"
                  ? "border-l-danger"
                  : "border-l-warn",
            )}
          >
            <span className="min-w-0">
              <span
                className={cx(
                  "text-ink block text-sm font-medium",
                  item.kind === "vehicle" && "tabular-nums",
                )}
              >
                {item.ownerName}
              </span>
              <span className="text-ink-3 block text-xs">
                {DOCUMENT_LABELS[item.type as DocumentType]}
                {item.expiresAt
                  ? ` · ${item.status === "expired" ? "expired" : "expires"} ${formatDate(new Date(item.expiresAt))}`
                  : " · not on record"}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <DocumentStatusBadge
                status={item.status}
                expiresAt={item.expiresAt}
                now={now}
              />
              {isBlocking(item.status) ? (
                <span className="text-danger text-xs font-medium">
                  Assignment blocked
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function ComplianceView(props: AdminViewServerProps) {
  const context = requireStaff(props, "compliance.view", "/admin/compliance");
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();
  const tab = param(props.searchParams, "tab") === "vehicles" ? "vehicles" : "drivers";

  const { drivers, vehicles } = await loadComplianceItems(payload, user, now);
  const items = tab === "vehicles" ? vehicles : drivers;
  const count = (status: DocumentStatus) =>
    items.filter((item) => item.status === status).length;
  const blocked = (list: ComplianceItem[]) =>
    new Set(list.filter((item) => isBlocking(item.status)).map((item) => item.ownerId))
      .size;

  return (
    <OpsShell user={user} active="compliance">
      <PageHeader
        title="Compliance"
        description="PHV licences, MOT, insurance and the rest (CMP-10). Expired or missing documents block assignment."
        actions={
          <div
            role="tablist"
            aria-label="Records"
            className="border-line-strong bg-surface inline-flex rounded-md border p-0.5 shadow-xs"
          >
            {(["drivers", "vehicles"] as const).map((name) => (
              <Link
                key={name}
                role="tab"
                aria-selected={tab === name}
                href={
                  name === "drivers"
                    ? "/admin/compliance"
                    : "/admin/compliance?tab=vehicles"
                }
                className={cx(
                  "flex h-9 items-center rounded-sm px-3 text-sm font-medium lg:h-7",
                  tab === name
                    ? "bg-accent-soft text-accent"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {name === "drivers"
                  ? `Drivers · ${blocked(drivers)} blocked`
                  : `Vehicles · ${blocked(vehicles)} blocked`}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {BANDS.map((band) => (
          <MetricCard
            key={band.status}
            label={band.label}
            value={count(band.status)}
            tone={
              count(band.status) === 0
                ? undefined
                : band.status === "missing" ||
                    band.status === "expired" ||
                    band.status === "expiring_7"
                  ? "danger"
                  : band.status === "valid"
                    ? undefined
                    : "warn"
            }
          />
        ))}
      </div>

      <Panel
        title="Needs attention"
        description="Most urgent first. Open a record to add or renew a document."
        bodyClassName="p-0"
      >
        <AttentionList items={items} now={now} />
      </Panel>
    </OpsShell>
  );
}
