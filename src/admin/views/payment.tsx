import { ArrowLeft, ExternalLink, Undo2 } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { voidCustomerPaymentAction } from "@/admin/actions/payments";
import { RefundList } from "@/admin/components/refund-list";
import { loadPaymentDetail, type PaymentKind } from "@/admin/data/payments";
import { clock, londonDay, shortDay } from "@/admin/format";
import { RefundForm } from "@/admin/forms/refund-form";
import { param, requireStaff, segment } from "@/admin/guard";
import { counted } from "@/components/ops/charts/scale";
import { ConfirmDialog } from "@/components/ops/dialog";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
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
} from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { DeniedPage, EmptyState } from "@/components/ops/states";
import { refundable } from "@/domain/finance/customer-money";
import { JOB_STATUS_LABELS } from "@/domain/jobs/labels";
import { formatPence, type Pence } from "@/domain/money";
import { can } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/time";

/**
 * One payment from a customer (Payments): a website card payment, from
 * Stripe, or an office booking's, recorded by hand — what it paid for, its
 * card fee, the refunds recorded against it, and recording another. A refund
 * is made in Stripe or by bank first; this only records it. Owner and
 * Accounts.
 */

const money = (pence: number) => formatPence(pence as Pence);
const NOTICES: Record<string, string> = {
  refunded: "Refund recorded.",
  "refund-voided": "Refund voided.",
  voided: "Payment voided. Its bookings are waiting for payment again.",
};

export async function PaymentView(props: AdminViewServerProps) {
  const kindSegment = segment(props, 1);
  const idSegment = segment(props, 2);
  const here = `/admin/payments/${kindSegment}/${idSegment}`;
  const context = requireStaff(props, "payments.view", here);
  if (context.denied) return <DeniedPage reason={context.reason} />;
  const { user, payload } = context;
  const now = new Date();

  const kind: PaymentKind | null =
    kindSegment === "website" || kindSegment === "office" ? kindSegment : null;
  const data =
    kind && Number.isInteger(Number(idSegment)) && Number(idSegment) > 0
      ? await loadPaymentDetail(payload, user, kind, Number(idSegment))
      : null;
  if (!kind || !data) {
    return (
      <OpsShell user={user} active="payments">
        <Panel>
          <EmptyState
            title="No payment with that number"
            action={<ButtonLink href="/admin/payments">Back to Payments</ButtonLink>}
          />
        </Panel>
      </OpsShell>
    );
  }

  const { row, bookings, refunds } = data;
  const canRefund = can(user.role, "refunds.record") && !row.voided && !data.test;
  const canVoid =
    kind === "office" &&
    can(user.role, "payments.record") &&
    !row.voided &&
    !refunds.some((refund) => !refund.voided);
  const left = bookings
    .map((job) => ({ ...job, left: refundable(job.paidPence, job.refundedPence) }))
    .filter((job) => job.left > 0);
  const notice = NOTICES[param(props.searchParams, "notice")];
  const kept = row.amountPence - row.refundedPence - (row.feePence ?? 0);

  return (
    <OpsShell user={user} active="payments">
      <div className="mb-3">
        <Link
          href="/admin/payments"
          className="text-ink-3 hover:text-ink inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Payments
        </Link>
      </div>
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {data.test ? (
        <Notice tone="warn">
          A test booking: never counted, and no refund is recorded.
        </Notice>
      ) : null}
      <PageHeader
        eyebrow={kind === "website" ? "Card payment on the website" : "Office payment"}
        title={`${row.reference} · ${money(row.amountPence)}`}
        meta={
          row.voided ? (
            <Badge tone="danger">Void</Badge>
          ) : row.refundedPence >= row.amountPence ? (
            <Badge tone="neutral">Refunded in full</Badge>
          ) : row.refundedPence ? (
            <Badge tone="info">Part refunded</Badge>
          ) : null
        }
        actions={
          data.stripeUrl ? (
            <a
              href={data.stripeUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("secondary", "md")}
            >
              <ExternalLink aria-hidden className="h-4 w-4" />
              Open in Stripe
            </a>
          ) : null
        }
      />
      {row.voided ? (
        <Notice tone="danger">
          Void{data.voidedAt ? ` since ${formatDate(new Date(data.voidedAt))}` : ""}:{" "}
          {row.voidReason}
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Bookings it paid for" bodyClassName="p-0">
            <ul className="divide-line divide-y">
              {bookings.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="text-accent font-medium hover:underline"
                    >
                      {job.reference}
                    </Link>
                    <span className="text-ink-3">
                      {job.pickupAt
                        ? ` · ${shortDay(new Date(job.pickupAt))} ${clock(new Date(job.pickupAt))}`
                        : ""}
                      {job.status
                        ? ` · ${JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] ?? job.status}`
                        : ""}
                    </span>
                    <span className="text-ink-2 block truncate">{job.route}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="text-ink font-medium">{money(job.paidPence)}</span>
                    {job.refundedPence ? (
                      <span className="text-ink-3 block text-xs">
                        {money(job.refundedPence)} refunded
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Refunds"
            description="Made in Stripe or by bank by the office, and recorded here."
            bodyClassName="p-0"
          >
            {refunds.length === 0 ? (
              <EmptyState title="No refunds recorded" />
            ) : (
              <RefundList refunds={refunds} canVoid={canRefund} back={here} />
            )}
          </Panel>

          {canRefund && left.length ? (
            <Panel
              title="Record a refund"
              description={
                kind === "website"
                  ? "Refund it in Stripe first — Open in Stripe, then Refund — and record it here."
                  : "Send the money back first, then record it here."
              }
            >
              <div id="record-refund" className="scroll-mt-20">
                <RefundForm
                  key={refunds.length}
                  kind={kind}
                  paymentId={row.id}
                  today={londonDay(now)}
                  lines={left.map((job) => ({
                    id: job.id,
                    reference: job.reference,
                    label: job.pickupAt ? shortDay(new Date(job.pickupAt)) : "",
                    leftPence: job.left,
                  }))}
                />
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Payment">
            <Fields className="sm:grid-cols-1">
              <Field label="Paid">{formatDate(new Date(row.paidAt))}</Field>
              <Field label="How">{row.method}</Field>
              <Field label="Customer">
                {row.customer ? (
                  data.customerId ? (
                    <Link
                      href={`/admin/customers/${data.customerId}`}
                      className="text-accent hover:underline"
                    >
                      {row.customer}
                    </Link>
                  ) : (
                    row.customer
                  )
                ) : (
                  <NotRecorded />
                )}
              </Field>
              {row.paidBy ? <Field label="Paid by">{row.paidBy}</Field> : null}
              <Field label={kind === "website" ? "Stripe payment" : "Reference"}>
                {row.externalReference ? (
                  <span className="break-all">{row.externalReference}</span>
                ) : (
                  <NotRecorded>None</NotRecorded>
                )}
              </Field>
              {data.notes ? (
                <Field label="Notes">
                  <span className="whitespace-pre-line">{data.notes}</span>
                </Field>
              ) : null}
              {row.recordedBy ? (
                <Field label="Recorded by">{row.recordedBy}</Field>
              ) : null}
            </Fields>
          </Panel>

          <Panel title="Money">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Paid</dt>
                <dd className="font-medium tabular-nums">{money(row.amountPence)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Refunded</dt>
                <dd className="tabular-nums">
                  {row.refundedPence ? `− ${money(row.refundedPence)}` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Card fee</dt>
                <dd className="tabular-nums">
                  {row.feePence === null ? (
                    <NotRecorded>Not from Stripe yet</NotRecorded>
                  ) : row.feePence ? (
                    `− ${money(row.feePence)}`
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="border-line flex justify-between gap-3 border-t pt-2">
                <dt className="text-ink font-medium">Kept</dt>
                <dd className="font-semibold tabular-nums">
                  {row.voided ? "—" : money(kept)}
                </dd>
              </div>
            </dl>
          </Panel>

          {canVoid ? (
            <div>
              <ConfirmDialog
                label="Void this payment"
                icon={<Undo2 aria-hidden className="h-4 w-4" />}
                variant="ghost"
                title={`Void ${row.reference}?`}
                confirmLabel="Void payment"
                confirmVariant="danger"
                action={voidCustomerPaymentAction}
                fields={{ paymentId: row.id }}
              >
                <p>
                  It stays on record, marked void, and its{" "}
                  {counted(bookings.length, "booking")} wait for payment again.
                </p>
                <label htmlFor="void-payment" className="text-ink-2 font-medium">
                  Why is it void?
                </label>
                <textarea
                  id="void-payment"
                  name="reason"
                  rows={2}
                  required
                  className={TEXTAREA_CLASS}
                />
              </ConfirmDialog>
            </div>
          ) : null}
        </div>
      </div>
    </OpsShell>
  );
}
