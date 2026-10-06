import { ArrowLeft, Check, FileText, Undo2, X } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import {
  decideCancellationAction,
  markInvoiceSentAction,
  voidPartnerRecordAction,
} from "@/admin/actions/supplier-money";
import { INVOICE_STATE_LABELS, loadPartner } from "@/admin/data/supplier-money";
import { clock, isValidDay, londonDay, londonDayBounds, shortDay } from "@/admin/format";
import { PartnerMoneyForm } from "@/admin/forms/partner-money-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { counted } from "@/components/ops/charts/scale";
import { ActionButton, ConfirmDialog } from "@/components/ops/dialog";
import { FilterForm } from "@/components/ops/filter-form";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
import { Label, TextInput } from "@/components/ops/form-controls";
import {
  Badge,
  ButtonLink,
  buttonClass,
  Field,
  Fields,
  Notice,
  NotRecorded,
  PageHeader,
  Panel,
  type Tone,
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import {
  dueDate,
  invoiceNumber,
  partnerRoute,
  RECEIPT_METHODS,
  receiptReference,
  type ReceiptMethod,
} from "@/domain/finance/supplier-money";
import { formatPence, type Pence } from "@/domain/money";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";
import type { User } from "@/payload-types";

/**
 * One partner's money (Supplier Money): what they owe up to the chosen day —
 * tick bookings to record money that came in, or to make an invoice — the
 * late cancellations to decide, and every invoice and payment, each voidable
 * with a reason. Invoices are made here and sent by the office.
 */

const money = (pence: number) => formatPence(pence as Pence);
const STATE_TONE: Record<string, Tone> = {
  paid: "ok",
  part_paid: "info",
  unpaid: "neutral",
  overdue: "danger",
  void: "danger",
};
const NOTICES: Record<string, string> = {
  received: "Money received recorded.",
  invoiced: "Invoice made. Download the PDF and send it, then mark it sent.",
  decided: "Decision saved.",
  sent: "Invoice marked sent.",
  unsent: "Invoice marked not sent.",
  voided: "Voided. Its bookings are free again.",
};
const recorder = (value: unknown) =>
  value && typeof value === "object"
    ? ((value as User).name ?? (value as User).email)
    : "Staff";

export async function SupplierMoneyPartnerView(props: AdminViewServerProps) {
  const idSegment = segment(props, 1);
  const context = requireStaff(
    props,
    "supplierMoney.view",
    `/admin/supplier-money/${idSegment}`,
  );
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();
  const today = londonDay(now);
  const upToParam = param(props.searchParams, "upTo");
  const upTo = isValidDay(upToParam) ? upToParam : today;

  const data = Number.isInteger(Number(idSegment))
    ? await loadPartner(payload, user, Number(idSegment), londonDayBounds(upTo).end, now)
    : null;
  if (!data) {
    return (
      <OpsShell user={user} active="supplier-money">
        <Panel>
          <EmptyState
            title="No partner with that number"
            action={
              <ButtonLink href="/admin/supplier-money">Back to Supplier Money</ButtonLink>
            }
          />
        </Panel>
      </OpsShell>
    );
  }
  const { supplier, owed, receipts, invoices } = data;
  const canManage = can(user.role, "supplierMoney.manage");
  const invoiceNumbers = new Map(
    invoices.map((invoice) => [invoice.id, invoiceNumber(invoice.id)]),
  );
  const notice = NOTICES[param(props.searchParams, "notice")];
  const terms = supplier.paymentTermsDays ?? null;

  return (
    <OpsShell user={user} active="supplier-money">
      <div className="mb-3">
        <Link
          href="/admin/supplier-money"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Supplier Money
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      <PageHeader
        eyebrow="Supplier Money"
        title={supplier.name}
        meta={
          <Link
            href={`/admin/suppliers/${supplier.id}`}
            className="text-accent text-sm hover:underline"
          >
            Partner&apos;s page
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {owed.toDecide.length ? (
            <Panel
              title="Cancellations to decide"
              description="Does the partner pay for these? A late cancellation they pay for is billed at the booking's price."
              bodyClassName="p-0"
            >
              <ul className="divide-line divide-y">
                {owed.toDecide.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="text-ink font-medium tabular-nums">
                        {shortDay(new Date(job.pickupAt))} {clock(new Date(job.pickupAt))}
                      </span>
                      <span className="text-ink-3">
                        {" "}
                        ·{" "}
                        <Link href={`/admin/jobs/${job.id}`} className="hover:underline">
                          {job.reference}
                        </Link>
                        {job.supplierReference ? ` · ${job.supplierReference}` : ""} ·{" "}
                        {money(job.pricePence ?? 0)}
                      </span>
                      <span className="text-ink-2 block truncate">
                        {partnerRoute(job)}
                      </span>
                    </span>
                    {canManage ? (
                      <span className="flex shrink-0 flex-wrap gap-2">
                        <ActionButton
                          label="Partner pays"
                          icon={<Check aria-hidden className="h-4 w-4" />}
                          size="sm"
                          action={decideCancellationAction}
                          fields={{
                            jobId: job.id,
                            supplierId: supplier.id,
                            decision: "charged",
                          }}
                        />
                        <ActionButton
                          label="No charge"
                          icon={<X aria-hidden className="h-4 w-4" />}
                          variant="ghost"
                          size="sm"
                          action={decideCancellationAction}
                          fields={{
                            jobId: job.id,
                            supplierId: supplier.id,
                            decision: "not_charged",
                          }}
                        />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel
            title={`Owed up to ${formatDate(new Date(`${upTo}T12:00:00Z`))}`}
            description={`${counted(owed.owed.length, "booking")} · ${money(owed.totalPence)}${owed.overduePence ? ` · ${money(owed.overduePence)} overdue` : ""}`}
            actions={
              <FilterForm
                action={`/admin/supplier-money/${supplier.id}`}
                className="flex items-end gap-2"
              >
                <div>
                  <Label htmlFor="partner-up-to">Up to</Label>
                  <TextInput
                    id="partner-up-to"
                    name="upTo"
                    type="date"
                    defaultValue={upTo}
                  />
                </div>
              </FilterForm>
            }
          >
            {owed.owed.length === 0 ? (
              <EmptyState
                title="Nothing owed"
                description="Every booking up to this day is paid for."
              />
            ) : canManage ? (
              <PartnerMoneyForm
                key={owed.owed.map((job) => job.id).join(",")}
                supplierId={supplier.id}
                upTo={upTo}
                today={today}
                lines={owed.owed.map((job) => {
                  const due = dueDate(job, terms);
                  return {
                    id: job.id,
                    reference: job.reference,
                    supplierReference: job.supplierReference,
                    when: `${shortDay(new Date(job.pickupAt))} ${clock(new Date(job.pickupAt))}`,
                    route: partnerRoute(job),
                    status:
                      job.status === "cancelled"
                        ? "Late cancellation"
                        : job.status === "no_show"
                          ? "PNS"
                          : "Completed",
                    amountPence: job.pricePence ?? 0,
                    invoice: job.supplierInvoiceId
                      ? (invoiceNumbers.get(job.supplierInvoiceId) ?? "Invoiced")
                      : null,
                    due: formatDate(due),
                    overdue: due.getTime() < now.getTime(),
                  };
                })}
              />
            ) : (
              <p className="text-ink-2 text-sm">
                {owed.owed.length} bookings, {money(owed.totalPence)} owed.
              </p>
            )}
          </Panel>

          <Panel
            title="Invoices"
            description="Made here; sent by the office."
            bodyClassName="p-0"
          >
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              <ul className="divide-line divide-y">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            invoice.voidedAt
                              ? "text-ink-3 line-through"
                              : "text-ink font-semibold"
                          }
                        >
                          {invoiceNumber(invoice.id)}
                        </span>
                        <span className="tabular-nums">
                          {money(invoice.totalPence ?? 0)}
                        </span>
                        <Badge tone={STATE_TONE[invoice.state]}>
                          {INVOICE_STATE_LABELS[invoice.state]}
                        </Badge>
                        {invoice.sentAt && !invoice.voidedAt ? (
                          <Badge tone="neutral">
                            Sent {formatDate(new Date(invoice.sentAt))}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-ink-3 text-xs">
                        Dated {formatDate(new Date(invoice.issuedAt))}
                        {invoice.dueAt
                          ? ` · due ${formatDate(new Date(invoice.dueAt))}`
                          : ""}{" "}
                        · {counted(invoice.lines?.length ?? 0, "booking")}
                      </p>
                      {invoice.voidedAt ? (
                        <p className="text-danger text-xs">Void: {invoice.voidReason}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <a
                        href={`/api/supplier-money/invoices/${invoice.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonClass("secondary", "sm")}
                      >
                        <FileText aria-hidden className="h-4 w-4" />
                        PDF
                      </a>
                      {!invoice.voidedAt && canManage ? (
                        <ActionButton
                          label={invoice.sentAt ? "Mark not sent" : "Mark sent"}
                          variant="ghost"
                          size="sm"
                          action={markInvoiceSentAction}
                          fields={{
                            invoiceId: invoice.id,
                            supplierId: supplier.id,
                            sent: invoice.sentAt ? "0" : "1",
                          }}
                        />
                      ) : null}
                      {!invoice.voidedAt && canManage ? (
                        <ConfirmDialog
                          label="Void"
                          icon={<Undo2 aria-hidden className="h-4 w-4" />}
                          variant="ghost"
                          size="sm"
                          title={`Void ${invoiceNumber(invoice.id)}?`}
                          confirmLabel="Void invoice"
                          confirmVariant="danger"
                          action={voidPartnerRecordAction}
                          fields={{
                            recordId: invoice.id,
                            supplierId: supplier.id,
                            kind: "invoice",
                          }}
                        >
                          <p>
                            The invoice stays on record, marked void, and its bookings can
                            go on a new one. Tell the partner if it was sent.
                          </p>
                          <label
                            htmlFor={`void-invoice-${invoice.id}`}
                            className="text-ink-2 font-medium"
                          >
                            Why is it void?
                          </label>
                          <textarea
                            id={`void-invoice-${invoice.id}`}
                            name="reason"
                            rows={2}
                            required
                            className={TEXTAREA_CLASS}
                          />
                        </ConfirmDialog>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Money received" bodyClassName="p-0">
            {receipts.length === 0 ? (
              <EmptyState title="Nothing received yet" />
            ) : (
              <ul className="divide-line divide-y">
                {receipts.map((receipt) => (
                  <li
                    key={receipt.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            receipt.voidedAt
                              ? "text-ink-3 line-through"
                              : "text-ink font-semibold"
                          }
                        >
                          {receiptReference(receipt.id)}
                        </span>
                        <span className="tabular-nums">
                          {money(receipt.amountPence ?? 0)}
                        </span>
                        {receipt.voidedAt ? <Badge tone="danger">Void</Badge> : null}
                      </p>
                      <p className="text-ink-3 text-xs">
                        {formatDate(new Date(receipt.receivedAt))} ·{" "}
                        {RECEIPT_METHODS[receipt.method as ReceiptMethod] ??
                          receipt.method}
                        {receipt.reference ? ` · ${receipt.reference}` : ""} ·{" "}
                        {counted(receipt.lines?.length ?? 0, "booking")} · recorded by{" "}
                        {recorder(receipt.recordedBy)}
                      </p>
                      {receipt.voidedAt ? (
                        <p className="text-danger text-xs">Void: {receipt.voidReason}</p>
                      ) : null}
                    </div>
                    {!receipt.voidedAt && canManage ? (
                      <ConfirmDialog
                        label="Void"
                        icon={<Undo2 aria-hidden className="h-4 w-4" />}
                        variant="ghost"
                        size="sm"
                        title={`Void ${receiptReference(receipt.id)}?`}
                        confirmLabel="Void payment"
                        confirmVariant="danger"
                        action={voidPartnerRecordAction}
                        fields={{
                          recordId: receipt.id,
                          supplierId: supplier.id,
                          kind: "receipt",
                        }}
                      >
                        <p>
                          It stays on record, marked void, and its{" "}
                          {counted(receipt.lines?.length ?? 0, "booking")} count as owed
                          again.
                        </p>
                        <label
                          htmlFor={`void-receipt-${receipt.id}`}
                          className="text-ink-2 font-medium"
                        >
                          Why is it void?
                        </label>
                        <textarea
                          id={`void-receipt-${receipt.id}`}
                          name="reason"
                          rows={2}
                          required
                          className={TEXTAREA_CLASS}
                        />
                      </ConfirmDialog>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Billing">
            <Fields className="sm:grid-cols-1">
              <Field label="Payment terms">
                {terms ? (
                  `${terms} days after the pickup`
                ) : (
                  <NotRecorded>Not set — due at once</NotRecorded>
                )}
              </Field>
              <Field label="Invoices go to">
                {supplier.billingAddress ? (
                  <span className="whitespace-pre-line">
                    {supplier.contactName ? `${supplier.contactName}\n` : ""}
                    {supplier.name}
                    {"\n"}
                    {supplier.billingAddress}
                  </span>
                ) : (
                  <span className="text-sm">
                    <NotRecorded>No billing address.</NotRecorded>{" "}
                    <Link
                      href={`/admin/suppliers/${supplier.id}/edit`}
                      className="text-accent hover:underline"
                    >
                      Add one
                    </Link>
                  </span>
                )}
              </Field>
              <Field label="Email">
                {supplier.email || <NotRecorded>None</NotRecorded>}
              </Field>
            </Fields>
          </Panel>
        </div>
      </div>
    </OpsShell>
  );
}
