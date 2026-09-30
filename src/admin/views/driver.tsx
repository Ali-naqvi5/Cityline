import { ArrowLeft, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { verifyDocumentAction } from "@/admin/actions/fleet";
import { loadDrivers } from "@/admin/data/fleet";
import { money, pickupLabel, stamp } from "@/admin/format";
import { BankDetailsForm } from "@/admin/forms/bank-details-form";
import { DocumentForm } from "@/admin/forms/document-form";
import { param, requireStaff, segment } from "@/admin/guard";
import {
  ComplianceBadge,
  DocumentStatusBadge,
  DRIVER_STATUS_TONE,
} from "@/components/ops/compliance";
import { JobStatusBadge } from "@/components/ops/jobs";
import {
  Badge,
  buttonClass,
  ButtonLink,
  Field,
  Fields,
  Notice,
  NotRecorded,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import {
  DOCUMENT_LABELS,
  documentStatus,
  DRIVER_DOCUMENT_TYPES,
  EXPIRING_TYPES,
  type DocumentType,
} from "@/domain/compliance/documents";
import {
  DRIVER_STATUS_LABELS,
  EMPLOYMENT_LABELS,
  PAY_MESSAGE_LABELS,
} from "@/domain/fleet/labels";
import { OPEN_STATUSES } from "@/domain/jobs/labels";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";
import type { PrivateFile, User } from "@/payload-types";

const NOTICES: Record<string, string> = {
  created:
    "Driver added. Now add their documents — they cannot be given jobs until the required ones are on record.",
  saved: "Changes saved.",
  "document-added": "Document added.",
  "document-checked": "Document marked as checked.",
  "bank-saved": "Bank details saved.",
  "bank-removed": "Bank details removed.",
};

function fileOf(value: unknown): PrivateFile | null {
  return value && typeof value === "object" ? (value as PrivateFile) : null;
}

function checkerOf(value: unknown): User | null {
  return value && typeof value === "object" ? (value as User) : null;
}

export async function DriverView(props: AdminViewServerProps) {
  const id = Number(segment(props, 1));
  const context = requireStaff(
    props,
    "drivers.view",
    `/admin/drivers/${segment(props, 1)}`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const [record] = Number.isInteger(id)
    ? await loadDrivers(payload, user, now, { id: { equals: id } })
    : [];
  if (!record) {
    return (
      <OpsShell user={user} active="drivers">
        <Panel>
          <EmptyState
            title="No driver with that number"
            action={<ButtonLink href="/admin/drivers">Back to drivers</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }
  const { driver, documents, required, worst } = record;

  const [upcoming, recent, vehicles] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: {
        and: [{ driver: { equals: id } }, { status: { in: [...OPEN_STATUSES] } }],
      },
      sort: "pickupAt",
      limit: 10,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: "jobs",
      where: {
        and: [{ driver: { equals: id } }, { status: { not_in: [...OPEN_STATUSES] } }],
      },
      sort: "-pickupAt",
      limit: 10,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: "vehicles",
      where: { drivers: { in: [id] } },
      depth: 0,
      limit: 20,
      user,
      overrideAccess: false,
    }),
  ]);

  const canEdit = can(user.role, "drivers.edit");
  const canVerify = can(user.role, "compliance.verify");
  const seesBank = can(user.role, "drivers.bankDetails");
  const notice = NOTICES[param(props.searchParams, "notice")];

  const pay =
    driver.payRule === "percent"
      ? driver.payPercentBp
        ? `${driver.payPercentBp / 100}% of net revenue`
        : "Percentage, not set"
      : driver.payRule === "fixed"
        ? driver.payFixedPence
          ? `${money(driver.payFixedPence)} per job`
          : "Fixed amount, not set"
        : "Rate card";

  return (
    <OpsShell user={user} active="drivers">
      <div className="mb-3">
        <Link
          href="/admin/drivers"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Drivers
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      <PageHeader
        eyebrow="Driver"
        title={driver.fullName}
        meta={
          <>
            <Badge tone={DRIVER_STATUS_TONE[driver.status]}>
              {DRIVER_STATUS_LABELS[driver.status]}
            </Badge>
            <ComplianceBadge worst={worst} />
          </>
        }
        actions={
          canEdit ? (
            <ButtonLink href={`/admin/drivers/${driver.id}/edit`}>
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
            description="Missing or expired documents block assignment. Checked at each job's pickup time."
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
                            {item.document.number ? `No. ${item.document.number} · ` : ""}
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
                          <input type="hidden" name="kind" value="driver" />
                          <input
                            type="hidden"
                            name="documentId"
                            value={item.document.id}
                          />
                          <input type="hidden" name="ownerId" value={driver.id} />
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
                kind="driver"
                ownerId={driver.id}
                types={DRIVER_DOCUMENT_TYPES.map((type) => ({
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
                description="Add the PHV licence, DVLA licence, DBS and right to work."
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
            {upcoming.docs.length + recent.docs.length === 0 ? (
              <EmptyState
                title="No jobs yet"
                description="Jobs this driver is assigned to appear here."
              />
            ) : (
              <ul className="divide-line divide-y">
                {[...upcoming.docs, ...recent.docs].map((job) => (
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
              <Field label="Mobile (WhatsApp)">
                <a
                  href={`tel:${driver.phone}`}
                  className="text-accent tabular-nums hover:underline"
                >
                  {driver.phone}
                </a>
              </Field>
              <Field label="Email">
                {driver.email || <NotRecorded>None</NotRecorded>}
              </Field>
              <Field label="Date of birth">
                {driver.dateOfBirth ? (
                  formatDate(new Date(driver.dateOfBirth))
                ) : (
                  <NotRecorded>Not recorded</NotRecorded>
                )}
              </Field>
              <Field label="Address">
                {driver.address ? (
                  <span className="whitespace-pre-line">{driver.address}</span>
                ) : (
                  <NotRecorded>Not recorded</NotRecorded>
                )}
              </Field>
              <Field label="Employment">
                {EMPLOYMENT_LABELS[driver.employmentType]}
                {driver.startDate ? (
                  <span className="text-ink-3 block text-sm">
                    Since {formatDate(new Date(driver.startDate))}
                  </span>
                ) : null}
                {driver.endDate ? (
                  <span className="text-ink-3 block text-sm">
                    Until {formatDate(new Date(driver.endDate))}
                  </span>
                ) : null}
              </Field>
            </Fields>
          </Panel>

          <Panel title="Pay and messages">
            <Fields className="sm:grid-cols-1">
              <Field label="Pay rule">{pay}</Field>
              <Field label="Pay in job messages">
                {PAY_MESSAGE_LABELS[driver.showPayInMessages]}
              </Field>
              <Field label="WhatsApp consent">
                {driver.whatsappConsentAt ? (
                  `Given ${formatDate(new Date(driver.whatsappConsentAt))}`
                ) : (
                  <NotRecorded>Not given — no messages will be sent</NotRecorded>
                )}
              </Field>
            </Fields>
          </Panel>

          <Panel title="Vehicles" bodyClassName="p-0">
            {vehicles.docs.length === 0 ? (
              <p className="text-ink-3 px-4 py-3 text-sm">
                No vehicle linked. Link one from the vehicle&apos;s page.
              </p>
            ) : (
              <ul className="divide-line divide-y">
                {vehicles.docs.map((vehicle) => (
                  <li key={vehicle.id}>
                    <Link
                      href={`/admin/vehicles/${vehicle.id}`}
                      className="hover:bg-sunken/60 block px-4 py-2.5"
                    >
                      <span className="text-ink block text-sm font-medium tabular-nums">
                        {vehicle.registration}
                      </span>
                      <span className="text-ink-3 block text-xs">
                        {vehicle.colour} {vehicle.make} {vehicle.model}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {seesBank ? (
            <Panel title="Bank details" description="Owner only. Stored encrypted.">
              <p className="text-ink-2 mb-4 text-sm">
                {driver.bankAccountLast4 ? (
                  <>
                    Account ending{" "}
                    <span className="font-medium tabular-nums">
                      •••• {driver.bankAccountLast4}
                    </span>
                  </>
                ) : (
                  <NotRecorded>No bank details on record</NotRecorded>
                )}
              </p>
              <BankDetailsForm
                driverId={driver.id}
                hasDetails={Boolean(driver.bankAccountLast4)}
              />
            </Panel>
          ) : null}

          {driver.notes ? (
            <Panel title="Notes">
              <p className="text-ink-2 text-sm whitespace-pre-line">{driver.notes}</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
