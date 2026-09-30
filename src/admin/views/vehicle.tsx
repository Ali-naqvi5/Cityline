import { ArrowLeft, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { verifyDocumentAction } from "@/admin/actions/fleet";
import { loadVehicles } from "@/admin/data/fleet";
import { pickupLabel, stamp } from "@/admin/format";
import { DocumentForm } from "@/admin/forms/document-form";
import { param, requireStaff, segment } from "@/admin/guard";
import {
  ComplianceBadge,
  DocumentStatusBadge,
  VEHICLE_STATUS_TONE,
} from "@/components/ops/compliance";
import { JobStatusBadge } from "@/components/ops/jobs";
import {
  Badge,
  buttonClass,
  ButtonLink,
  Field,
  Fields,
  Notice,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import {
  DOCUMENT_LABELS,
  documentStatus,
  EXPIRING_TYPES,
  VEHICLE_DOCUMENT_TYPES,
  type DocumentType,
} from "@/domain/compliance/documents";
import { OWNERSHIP_LABELS, VEHICLE_STATUS_LABELS } from "@/domain/fleet/labels";
import { vehicleClassName } from "@/domain/jobs/labels";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";
import type { Driver, PrivateFile, User } from "@/payload-types";

const NOTICES: Record<string, string> = {
  created:
    "Vehicle added. Now add its PHV licence, MOT and insurance — it cannot be given jobs until they are on record.",
  saved: "Changes saved.",
  "document-added": "Document added.",
  "document-checked": "Document marked as checked.",
};

const fileOf = (value: unknown) =>
  value && typeof value === "object" ? (value as PrivateFile) : null;
const checkerOf = (value: unknown) =>
  value && typeof value === "object" ? (value as User) : null;

export async function VehicleView(props: AdminViewServerProps) {
  const id = Number(segment(props, 1));
  const context = requireStaff(
    props,
    "vehicles.view",
    `/admin/vehicles/${segment(props, 1)}`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const [record] = Number.isInteger(id)
    ? await loadVehicles(payload, user, now, { id: { equals: id } })
    : [];
  if (!record) {
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
  const { vehicle, documents, required, worst } = record;

  const jobs = await payload.find({
    collection: "jobs",
    where: { vehicle: { equals: id } },
    sort: "-pickupAt",
    limit: 15,
    depth: 0,
    user,
    overrideAccess: false,
  });

  const canEdit = can(user.role, "vehicles.edit");
  const canVerify = can(user.role, "compliance.verify");
  const notice = NOTICES[param(props.searchParams, "notice")];
  const drivers = (Array.isArray(vehicle.drivers) ? vehicle.drivers : []).filter(
    (driver): driver is Driver => Boolean(driver) && typeof driver === "object",
  );

  return (
    <OpsShell user={user} active="vehicles">
      <div className="mb-3">
        <Link
          href="/admin/vehicles"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Vehicles
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <PageHeader
        eyebrow={`${vehicle.colour} ${vehicle.make} ${vehicle.model}`}
        title={<span className="tabular-nums">{vehicle.registration}</span>}
        meta={
          <>
            <Badge tone={VEHICLE_STATUS_TONE[vehicle.status]}>
              {VEHICLE_STATUS_LABELS[vehicle.status]}
            </Badge>
            <ComplianceBadge worst={worst} />
          </>
        }
        actions={
          canEdit ? (
            <ButtonLink href={`/admin/vehicles/${vehicle.id}/edit`}>
              <Pencil aria-hidden className="h-4 w-4" />
              Edit
            </ButtonLink>
          ) : null
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            title="Compliance"
            description="Missing or expired documents block assignment."
            bodyClassName="p-0"
          >
            <ul className="divide-line divide-y">
              {required.map((item) => {
                const file = fileOf(item.document?.file);
                const checker = checkerOf(item.document?.verifiedBy);
                return (
                  <li
                    key={item.type}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">
                        {DOCUMENT_LABELS[item.type as DocumentType]}
                      </p>
                      <p className="text-ink-3 text-xs">
                        {item.document ? (
                          <>
                            {item.document.expiresAt
                              ? `Expires ${formatDate(new Date(item.document.expiresAt))}`
                              : "No expiry"}
                            {checker ? ` · Checked by ${checker.name}` : " · Not checked"}
                          </>
                        ) : (
                          "Not on record"
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <DocumentStatusBadge
                        status={item.status}
                        expiresAt={item.document?.expiresAt}
                        now={now}
                      />
                      {file?.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonClass("ghost", "sm")}
                        >
                          <FileText aria-hidden className="h-4 w-4" />
                          View
                        </a>
                      ) : null}
                      {item.document && !checker && canVerify ? (
                        <form action={verifyDocumentAction}>
                          <input type="hidden" name="kind" value="vehicle" />
                          <input
                            type="hidden"
                            name="documentId"
                            value={item.document.id}
                          />
                          <input type="hidden" name="ownerId" value={vehicle.id} />
                          <button
                            type="submit"
                            className={buttonClass("secondary", "sm")}
                          >
                            Mark checked
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {canVerify ? (
            <Panel
              title="Add a document"
              description="A renewal is added as a new document; the latest one counts."
            >
              <DocumentForm
                kind="vehicle"
                ownerId={vehicle.id}
                types={VEHICLE_DOCUMENT_TYPES.map((type) => ({
                  value: type,
                  label: DOCUMENT_LABELS[type],
                  expires: EXPIRING_TYPES.has(type),
                }))}
              />
            </Panel>
          ) : null}

          <Panel
            title="All documents"
            description={`${documents.length} on record`}
            bodyClassName="p-0"
          >
            {documents.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="Add the PHV vehicle licence, MOT and hire-and-reward insurance."
              />
            ) : (
              <ul className="divide-line divide-y">
                {documents.map((document) => {
                  const file = fileOf(document.file);
                  return (
                    <li
                      key={document.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm">
                          {DOCUMENT_LABELS[document.type as DocumentType]}
                        </p>
                        <p className="text-ink-3 text-xs">
                          Added {stamp(new Date(document.createdAt))}
                          {document.expiresAt
                            ? ` · expires ${formatDate(new Date(document.expiresAt))}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DocumentStatusBadge
                          status={documentStatus(document, now)}
                          expiresAt={document.expiresAt}
                          now={now}
                        />
                        {file?.url ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent text-sm hover:underline"
                          >
                            View
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Jobs" bodyClassName="p-0">
            {jobs.docs.length === 0 ? (
              <EmptyState
                title="No jobs yet"
                description="Jobs done in this vehicle appear here."
              />
            ) : (
              <ul className="divide-line divide-y">
                {jobs.docs.map((job) => (
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
                          {job.reference} · {job.pickupAddress}
                        </span>
                      </span>
                      <JobStatusBadge status={job.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Details">
            <Fields className="sm:grid-cols-1">
              <Field label="Class">{vehicleClassName(vehicle.vehicleClassSlug)}</Field>
              <Field label="Passenger seats">{vehicle.seats ?? "—"}</Field>
              <Field label="Ownership">{OWNERSHIP_LABELS[vehicle.ownership]}</Field>
            </Fields>
          </Panel>
          <Panel title="Drivers" bodyClassName="p-0">
            {drivers.length === 0 ? (
              <p className="text-ink-3 px-4 py-3 text-sm">No driver linked.</p>
            ) : (
              <ul className="divide-line divide-y">
                {drivers.map((driver) => (
                  <li key={driver.id}>
                    <Link
                      href={`/admin/drivers/${driver.id}`}
                      className="hover:bg-sunken/60 block px-4 py-2.5"
                    >
                      <span className="text-ink block text-sm font-medium">
                        {driver.fullName}
                      </span>
                      <span className="text-ink-3 block text-xs tabular-nums">
                        {driver.phone}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {vehicle.notes ? (
            <Panel title="Notes">
              <p className="text-ink-2 text-sm whitespace-pre-line">{vehicle.notes}</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
