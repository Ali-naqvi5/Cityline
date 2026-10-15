import { ArrowLeft, FileText, Landmark, Pencil, Wallet } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { money, pickupLabel } from "@/admin/format";
import { BankDetailsForm } from "@/admin/forms/bank-details-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { ContactButtons } from "@/components/ops/contact-buttons";
import { JobStatusBadge } from "@/components/ops/jobs";
import {
  ButtonLink,
  Field,
  Fields,
  MetricCard,
  Notice,
  NotRecorded,
  PageHeader,
  Panel,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { licensedFromText, operatorCheck } from "@/domain/operators/operators";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";
import type { Operator, PrivateFile } from "@/payload-types";

import { OperatorStatus } from "./operators";

const NOTICES: Record<string, string> = {
  created:
    "Operator added. Bookings can now be given to them from a booking's Assign page.",
  saved: "Changes saved.",
  "bank-saved": "Bank details saved, sealed.",
  "bank-removed": "Bank details removed.",
};

const date = (iso: string | null | undefined) => (iso ? formatDate(new Date(iso)) : null);

/** One subcontracting operator (Cityline, 15 Oct 2026). */
export async function OperatorView(props: AdminViewServerProps) {
  const id = Number(segment(props, 1));
  const context = requireStaff(
    props,
    "operators.view",
    `/admin/operators/${segment(props, 1)}`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const operator = Number.isInteger(id)
    ? ((await payload.findByID({
        collection: "operators",
        id,
        depth: 1,
        user,
        overrideAccess: false,
        disableErrors: true,
      })) as Operator | null)
    : null;
  if (!operator) {
    return (
      <OpsShell user={user} active="operators">
        <Panel>
          <EmptyState
            title="No operator with that number"
            action={<ButtonLink href="/admin/operators">Back to operators</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const notTest = { isTest: { not_equals: true } };
  const [recent, total, completed] = await Promise.all([
    payload.find({
      collection: "jobs",
      where: { and: [{ operator: { equals: id } }, notTest] },
      sort: "-pickupAt",
      limit: 15,
      depth: 0,
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: "jobs",
      where: { and: [{ operator: { equals: id } }, notTest] },
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: "jobs",
      where: {
        and: [{ operator: { equals: id } }, { status: { equals: "completed" } }, notTest],
      },
      user,
      overrideAccess: false,
    }),
  ]);

  const notice = NOTICES[param(props.searchParams, "notice")];
  const { blocks, warnings } = operatorCheck(operator, now);
  const copy =
    operator.licenceCopy && typeof operator.licenceCopy === "object"
      ? (operator.licenceCopy as PrivateFile)
      : null;
  const seesBank = can(user.role, "drivers.bankDetails");
  const paysOperators = can(user.role, "driverPay.view");

  return (
    <OpsShell user={user} active="operators">
      <div className="mb-3">
        <Link
          href="/admin/operators"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Subcontracting operators
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {blocks.length ? (
        <Notice tone="danger">{blocks.join(" ")} No booking can go to them.</Notice>
      ) : null}

      <PageHeader
        eyebrow="Subcontracting operator"
        title={operator.name}
        meta={<OperatorStatus operator={operator} now={now} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {paysOperators ? (
              <ButtonLink href={`/admin/driver-pay/operators/${operator.id}`}>
                <Wallet aria-hidden className="h-4 w-4" />
                Driver Pay
              </ButtonLink>
            ) : null}
            {can(user.role, "operators.edit") ? (
              <ButtonLink href={`/admin/operators/${operator.id}/edit`}>
                <Pencil aria-hidden className="h-4 w-4" />
                Edit
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="Bookings" value={total.totalDocs} />
        <MetricCard label="Completed" value={completed.totalDocs} />
        <MetricCard
          label="Licence expires"
          value={date(operator.licenceExpiresAt) ?? "—"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Recent bookings" bodyClassName="p-0">
            {recent.docs.length === 0 ? (
              <EmptyState title="No bookings given to this operator yet" />
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
                          {job.driverPricePence !== null &&
                          job.driverPricePence !== undefined
                            ? ` · operator price ${money(job.driverPricePence)}`
                            : ""}
                        </span>
                      </span>
                      <JobStatusBadge status={job.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Licence"
            description="The booking's record names the operator and their licence."
          >
            <Fields>
              <Field label="Licensed by">{licensedFromText(operator)}</Field>
              <Field label="Operator licence">
                {operator.licenceNumber || <NotRecorded>Not recorded</NotRecorded>}
              </Field>
              <Field label="Expires">
                {date(operator.licenceExpiresAt) ?? (
                  <NotRecorded>Not recorded</NotRecorded>
                )}
              </Field>
              <Field label="Copy">
                {copy?.url ? (
                  <a
                    href={copy.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent inline-flex items-center gap-1 hover:underline"
                  >
                    <FileText aria-hidden className="h-4 w-4" />
                    Open the licence
                  </a>
                ) : (
                  <NotRecorded>None on record</NotRecorded>
                )}
              </Field>
              <Field label="Operating centre" wide>
                {operator.operatingCentre ? (
                  <span className="whitespace-pre-line">{operator.operatingCentre}</span>
                ) : (
                  <NotRecorded>Not recorded</NotRecorded>
                )}
              </Field>
            </Fields>
            {warnings.length ? (
              <p className="text-warn mt-3 text-sm">{warnings.join(" ")}</p>
            ) : null}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Contact">
            <Fields className="sm:grid-cols-1">
              <Field label="Name">{operator.contactName || "—"}</Field>
              <Field label="Phone">
                <span className="tabular-nums">{operator.phone}</span>
                <ContactButtons
                  phone={operator.phone}
                  who={operator.contactName || operator.name}
                />
              </Field>
              <Field label="Email">
                {operator.email ? (
                  <a
                    href={`mailto:${operator.email}`}
                    className="text-accent hover:underline"
                  >
                    {operator.email}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="WhatsApp">
                {operator.whatsappConsentAt
                  ? `Agreed ${date(operator.whatsappConsentAt)}`
                  : "Not agreed"}
              </Field>
            </Fields>
          </Panel>

          <Panel title="With Cityline">
            <Fields className="sm:grid-cols-1">
              <Field label="Joined">{date(operator.dateJoined) ?? "—"}</Field>
              <Field label="Left">{date(operator.dateLeft) ?? "—"}</Field>
              <Field label="Legal name">{operator.legalName || "—"}</Field>
              <Field label="Company number">{operator.companyNumber || "—"}</Field>
              <Field label="VAT number">{operator.vatNumber || "—"}</Field>
            </Fields>
          </Panel>

          {seesBank ? (
            <Panel
              icon={<Landmark />}
              title="Bank details"
              description="Owner and Accounts only. Stored encrypted; used to pay them in Driver Pay."
            >
              <p className="text-ink-2 mb-4 text-sm">
                {operator.bankAccountLast4 ? (
                  <>
                    Account ending{" "}
                    <span className="font-medium tabular-nums">
                      •••• {operator.bankAccountLast4}
                    </span>
                  </>
                ) : (
                  <NotRecorded>No bank details on record</NotRecorded>
                )}
              </p>
              <BankDetailsForm
                driverId={operator.id}
                operator
                hasDetails={Boolean(operator.bankAccountLast4)}
              />
            </Panel>
          ) : null}

          {operator.notes ? (
            <Panel title="Notes">
              <p className="text-ink-2 text-sm whitespace-pre-line">{operator.notes}</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
