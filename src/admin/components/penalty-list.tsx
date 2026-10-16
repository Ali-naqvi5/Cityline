import { Undo2 } from "lucide-react";
import Link from "next/link";

import { voidPenaltyAction } from "@/admin/actions/penalties";
import { ConfirmDialog } from "@/components/ops/dialog";
import { TEXTAREA_CLASS } from "@/components/ops/form-classes";
import { Badge } from "@/components/ops/primitives";
import { relId } from "@/domain/dispatch/assignment";
import { paymentReference } from "@/domain/finance/driver-pay";
import { penaltyReference } from "@/domain/finance/penalties";
import { invoiceNumber, receiptReference } from "@/domain/finance/supplier-money";
import { formatPence, type Pence } from "@/domain/money";
import { formatDate } from "@/lib/time";
import type { Driver, Operator, PartnerPenalty, User } from "@/payload-types";

const money = (pence: number) => formatPence(pence as Pence);

const nameOf = (value: unknown, fallback: string) =>
  value && typeof value === "object"
    ? ((value as Driver).fullName ??
      (value as Operator).name ??
      (value as User).name ??
      (value as User).email ??
      fallback)
    : fallback;

/**
 * Partner penalties (Cityline, 16 Oct 2026) as a list: what, when, how much,
 * who bears it, and whether a payment has taken it off yet. Each can be
 * voided with a reason until a payment or invoice holds it. On a partner
 * booking's page (its own), and on the partner's Supplier Money page.
 */
export function PenaltyList({
  penalties,
  canVoid,
  back,
  showBooking = false,
}: {
  /** Read with depth 1, for the names. */
  penalties: PartnerPenalty[];
  canVoid: boolean;
  /** Where the void returns to. */
  back: { from: "job"; jobId: number } | { from: "partner"; supplierId: number };
  showBooking?: boolean;
}) {
  return (
    <ul className="divide-line divide-y">
      {penalties.map((penalty) => {
        const reference = penaltyReference(penalty.id);
        const receipt = relId(penalty.supplierPayment);
        const invoice = relId(penalty.supplierInvoice);
        const driverPayment = relId(penalty.driverPayment);
        const share = penalty.driverSharePence ?? 0;
        const from = penalty.driver
          ? nameOf(penalty.driver, "the driver")
          : nameOf(penalty.operator, "the operator");
        const held = Boolean(receipt || invoice || driverPayment);
        const jobId = relId(penalty.job);
        return (
          <li
            key={penalty.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    penalty.voidedAt
                      ? "text-ink-3 line-through"
                      : "text-ink font-semibold"
                  }
                >
                  {reference}
                </span>
                <span className="tabular-nums">{money(penalty.amountPence)}</span>
                {penalty.voidedAt ? (
                  <Badge tone="danger">Void</Badge>
                ) : receipt ? (
                  <Badge tone="ok">Taken off {receiptReference(receipt)}</Badge>
                ) : (
                  <Badge tone="warn">Not taken off yet</Badge>
                )}
                {!penalty.voidedAt && invoice ? (
                  <Badge tone="info">On {invoiceNumber(invoice)}</Badge>
                ) : null}
              </p>
              <p className="text-ink-3 text-xs">
                {formatDate(new Date(penalty.penalisedAt))}
                {showBooking ? (
                  <>
                    {" · "}
                    {jobId ? (
                      <Link href={`/admin/jobs/${jobId}`} className="hover:underline">
                        {penalty.jobReference}
                      </Link>
                    ) : (
                      penalty.jobReference
                    )}
                    {penalty.supplierReference ? ` · ${penalty.supplierReference}` : ""}
                  </>
                ) : null}
                {penalty.partnerReference
                  ? ` · their ref ${penalty.partnerReference}`
                  : ""}{" "}
                · recorded by {nameOf(penalty.recordedBy, "Staff")}
              </p>
              <p className="text-ink-2 text-xs whitespace-pre-line">{penalty.reason}</p>
              <p className="text-ink-3 text-xs">
                {share
                  ? `${money(share)} from ${from}${
                      driverPayment
                        ? `, taken off ${paymentReference(driverPayment)}`
                        : ", off their next pay"
                    }; Cityline bears ${money(penalty.amountPence - share)}.`
                  : "Cityline bears it all."}
              </p>
              {penalty.voidedAt ? (
                <p className="text-danger text-xs">Void: {penalty.voidReason}</p>
              ) : null}
            </div>
            {!penalty.voidedAt && canVoid && !held ? (
              <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                <ConfirmDialog
                  label="Void"
                  icon={<Undo2 aria-hidden className="h-4 w-4" />}
                  variant="ghost"
                  size="sm"
                  title={`Void ${reference}?`}
                  confirmLabel="Void penalty"
                  confirmVariant="danger"
                  action={voidPenaltyAction}
                  fields={{
                    penaltyId: penalty.id,
                    ...(back.from === "job"
                      ? { from: "job", jobId: back.jobId }
                      : { from: "partner", supplierId: back.supplierId }),
                  }}
                >
                  <p>
                    It stays on record, marked void, and stops counting against the
                    partner, the profit{share ? " and the driver's pay" : ""}.
                  </p>
                  <label
                    htmlFor={`void-penalty-${penalty.id}`}
                    className="text-ink-2 font-medium"
                  >
                    Why is it void?
                  </label>
                  <textarea
                    id={`void-penalty-${penalty.id}`}
                    name="reason"
                    rows={2}
                    required
                    className={TEXTAREA_CLASS}
                  />
                </ConfirmDialog>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
