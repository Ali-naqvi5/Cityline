import { Undo2 } from "lucide-react";
import Link from "next/link";

import { voidRefundAction } from "@/admin/actions/payments";
import type { RefundRow } from "@/admin/data/payments";
import { ConfirmDialog } from "@/components/ops/dialog";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
import { Badge, buttonClass } from "@/components/ops/primitives";
import { formatPence, type Pence } from "@/domain/money";
import { formatDate } from "@/lib/time";

const money = (pence: number) => formatPence(pence as Pence);

/** Refunds, each voidable with a reason: on a payment's page, and on Refunds. */
export function RefundList({
  refunds,
  canVoid,
  back,
  showPayment = false,
}: {
  refunds: RefundRow[];
  canVoid: boolean;
  back: string;
  showPayment?: boolean;
}) {
  return (
    <ul className="divide-line divide-y">
      {refunds.map((refund) => (
        <li
          key={refund.id}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span
                className={
                  refund.voided ? "text-ink-3 line-through" : "text-ink font-semibold"
                }
              >
                {refund.reference}
              </span>
              <span className="tabular-nums">{money(refund.amountPence)}</span>
              {refund.voided ? <Badge tone="danger">Void</Badge> : null}
            </p>
            <p className="text-ink-3 text-xs">
              {formatDate(new Date(refund.refundedAt))} · {refund.method}
              {refund.externalReference ? ` · ${refund.externalReference}` : ""} ·{" "}
              {refund.bookings
                .map((job) => `${job.reference} ${money(job.amountPence)}`)
                .join(", ")}
              {showPayment && refund.customer ? ` · ${refund.customer}` : ""} · recorded
              by {refund.recordedBy ?? "Staff"}
            </p>
            <p className="text-ink-2 text-xs whitespace-pre-line">{refund.reason}</p>
            {refund.voided ? (
              <p className="text-danger text-xs">Void: {refund.voidReason}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {showPayment ? (
              <Link href={refund.payment.href} className={buttonClass("secondary", "sm")}>
                Payment
              </Link>
            ) : null}
            {!refund.voided && canVoid ? (
              <ConfirmDialog
                label="Void"
                icon={<Undo2 aria-hidden className="h-4 w-4" />}
                variant="ghost"
                size="sm"
                title={`Void ${refund.reference}?`}
                confirmLabel="Void refund"
                confirmVariant="danger"
                action={voidRefundAction}
                fields={{ refundId: refund.id, back }}
              >
                <p>
                  It stays on record, marked void, and stops counting. This does not undo
                  anything in Stripe or at the bank.
                </p>
                <label
                  htmlFor={`void-refund-${refund.id}`}
                  className="text-ink-2 font-medium"
                >
                  Why is it void?
                </label>
                <textarea
                  id={`void-refund-${refund.id}`}
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
  );
}
