"use client";

import { RotateCcw, Search } from "lucide-react";
import { useActionState, useState } from "react";

import { findPaymentForRefundAction, recordRefundAction } from "@/admin/actions/payments";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  inputClass,
  invalid,
  SubmitButton,
  submitWith,
  TEXTAREA_CLASS,
} from "@/components/ops/form";
import { REFUND_METHODS } from "@/domain/finance/customer-money";
import { formatPence, parsePounds, type Pence } from "@/domain/money";

export interface RefundFormLine {
  id: number;
  reference: string;
  label: string;
  /** What may still go back on this booking. */
  leftPence: number;
}

const money = (pence: number) => formatPence(pence as Pence);
const asPounds = (pence: number) => (pence / 100).toFixed(2);

/**
 * Recording a refund the office has already made — in Stripe for a website
 * payment, by bank or otherwise for an office one. Nothing here sends money
 * back; it keeps the books right.
 */
export function RefundForm({
  kind,
  paymentId,
  lines,
  today,
}: {
  kind: "website" | "office";
  paymentId: number;
  lines: RefundFormLine[];
  today: string;
}) {
  const [state, action, pending] = useActionState(recordRefundAction, EMPTY_FORM);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const total = lines.reduce(
    (sum, line) => sum + Math.max(0, parsePounds(amounts[line.id] ?? "") ?? 0),
    0,
  );
  const e = state.errors;
  const single = lines.length === 1;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="paymentId" value={paymentId} />

      <fieldset className="min-w-0">
        <legend className="text-ink-2 mb-2 text-sm font-medium">
          {single ? "Amount refunded" : "Amount refunded, by booking"}
        </legend>
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.id}>
              <input type="hidden" name="job" value={line.id} />
              <FormField
                id={`amount-${line.id}`}
                label={single ? `${line.reference}` : `${line.reference} · ${line.label}`}
                hint={`Up to ${money(line.leftPence)}.`}
                error={e[`amount-${line.id}`]}
              >
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <span
                      aria-hidden
                      className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
                    >
                      £
                    </span>
                    <input
                      id={`amount-${line.id}`}
                      name={`amount-${line.id}`}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amounts[line.id] ?? ""}
                      onChange={(event) =>
                        setAmounts((current) => ({
                          ...current,
                          [line.id]: event.target.value,
                        }))
                      }
                      className={inputClass("pl-7 tabular-nums")}
                      {...invalid(e[`amount-${line.id}`], `amount-${line.id}`)}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-accent shrink-0 text-sm hover:underline"
                    onClick={() =>
                      setAmounts((current) => ({
                        ...current,
                        [line.id]: asPounds(line.leftPence),
                      }))
                    }
                  >
                    All of it
                  </button>
                </div>
              </FormField>
            </li>
          ))}
        </ul>
        {e.amounts ? <p className="text-danger mt-1 text-sm">{e.amounts}</p> : null}
      </fieldset>

      {!single ? (
        <p className="border-line flex items-baseline justify-between rounded-md border p-3 text-sm">
          <span className="text-ink font-semibold">Refund</span>
          <span className="text-ink text-base font-semibold tabular-nums">
            {money(total)}
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="refundedAt" label="Date refunded" required error={e.refundedAt}>
          <input
            id="refundedAt"
            name="refundedAt"
            type="date"
            defaultValue={today}
            className={inputClass()}
            {...invalid(e.refundedAt, "refundedAt")}
          />
        </FormField>
        {kind === "office" ? (
          <FormField id="method" label="How" required error={e.method}>
            <select
              id="method"
              name="method"
              defaultValue="bank_transfer"
              className={inputClass()}
              {...invalid(e.method, "method")}
            >
              {Object.entries(REFUND_METHODS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
        <FormField
          id="reference"
          label={kind === "website" ? "Stripe refund id" : "Reference"}
          hint={
            kind === "website"
              ? "Optional. On the refund in Stripe, starting re_. Stops it being recorded twice."
              : "Optional. The bank's, or Stripe's re_… for a card payment link."
          }
          error={e.reference}
        >
          <input
            id="reference"
            name="reference"
            maxLength={100}
            autoComplete="off"
            className={inputClass()}
            {...invalid(e.reference, "reference")}
          />
        </FormField>
        <FormField id="reason" label="Why" required error={e.reason} wide>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={1000}
            className={TEXTAREA_CLASS}
            {...invalid(e.reason, "reason")}
          />
        </FormField>
      </div>

      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Recording…">
          <RotateCcw aria-hidden className="h-4 w-4" />
          {total > 0 ? `Record ${money(total)} refunded` : "Record refund"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Find the payment behind a booking's reference, to record a refund. */
export function FindPaymentForm() {
  const [state, action, pending] = useActionState(findPaymentForRefundAction, EMPTY_FORM);
  return (
    <form
      onSubmit={submitWith(action)}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      noValidate
    >
      <div className="min-w-0 sm:w-72">
        <FormField
          id="refund-reference"
          label="Booking reference"
          hint="The booking's, or the website booking's."
          error={state.errors.reference}
        >
          <input
            id="refund-reference"
            name="reference"
            autoComplete="off"
            className={inputClass("uppercase")}
            {...invalid(state.errors.reference, "refund-reference")}
          />
        </FormField>
      </div>
      <div className={state.errors.reference ? "sm:mb-6" : undefined}>
        <SubmitButton pending={pending} pendingLabel="Finding…" variant="secondary">
          <Search aria-hidden className="h-4 w-4" />
          Find the payment
        </SubmitButton>
      </div>
    </form>
  );
}
