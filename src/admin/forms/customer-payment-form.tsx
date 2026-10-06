"use client";

import { Banknote } from "lucide-react";
import { useActionState, useState } from "react";

import { recordCustomerPaymentAction } from "@/admin/actions/payments";
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
import { Badge, cx } from "@/components/ops/primitives";
import { CUSTOMER_PAYMENT_METHODS } from "@/domain/finance/customer-money";
import { formatPence, type Pence } from "@/domain/money";

export interface AwaitingFormLine {
  id: number;
  reference: string;
  customer: string;
  when: string;
  route: string;
  how: string;
  pickedUp: boolean;
  amountPence: number;
}

const money = (pence: number) => formatPence(pence as Pence);

/**
 * The office bookings waiting for their customer's money. Tick the ones a
 * payment covers — one customer's, or a company paying for several — and
 * record when and how it came in.
 */
export function CustomerPaymentForm({
  lines,
  today,
}: {
  lines: AwaitingFormLine[];
  today: string;
}) {
  const [state, action, pending] = useActionState(
    recordCustomerPaymentAction,
    EMPTY_FORM,
  );
  const [chosen, setChosen] = useState<Set<number>>(() => new Set());
  const picked = lines.filter((line) => chosen.has(line.id));
  const total = picked.reduce((sum, line) => sum + line.amountPence, 0);
  const customers = new Set(picked.map((line) => line.customer));
  const toggle = (id: number) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const e = state.errors;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4" noValidate>
      {/* A fieldset is as wide as its content unless told otherwise. */}
      <fieldset className="min-w-0">
        <legend className="sr-only">Bookings</legend>
        <p className="text-ink-3 mb-2 text-xs">
          {picked.length} of {lines.length} ticked
          {customers.size > 1 ? ` · ${customers.size} customers` : ""}
        </p>
        <ul className="border-line divide-line divide-y rounded-md border">
          {lines.map((line) => (
            <li key={line.id}>
              <label
                htmlFor={`awaiting-${line.id}`}
                className={cx(
                  "flex cursor-pointer items-start gap-3 px-3 py-2.5",
                  chosen.has(line.id) ? "bg-accent-soft/50" : "hover:bg-sunken",
                )}
              >
                <input
                  id={`awaiting-${line.id}`}
                  type="checkbox"
                  name="job"
                  value={line.id}
                  checked={chosen.has(line.id)}
                  onChange={() => toggle(line.id)}
                  className="accent-accent mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="text-ink font-medium">{line.customer}</span>
                  <span className="text-ink-3">
                    {" "}
                    · {line.reference} · {line.how}
                  </span>
                  <span className="text-ink-2 block truncate">
                    <span className="tabular-nums">{line.when}</span> · {line.route}
                  </span>
                  {line.pickedUp ? (
                    <Badge tone="warn" className="mt-0.5">
                      Picked up, not paid
                    </Badge>
                  ) : null}
                </span>
                <span className="text-ink shrink-0 text-sm font-medium tabular-nums">
                  {money(line.amountPence)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {e.jobs ? <p className="text-danger mt-1 text-sm">{e.jobs}</p> : null}
      </fieldset>

      <p className="border-line flex items-baseline justify-between rounded-md border p-3 text-sm">
        <span className="text-ink font-semibold">Ticked</span>
        <span className="text-ink text-base font-semibold tabular-nums">
          {money(total)}
        </span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="paidAt" label="Date paid" required error={e.paidAt}>
          <input
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={today}
            className={inputClass()}
            {...invalid(e.paidAt, "paidAt")}
          />
        </FormField>
        <FormField id="method" label="How" required error={e.method}>
          <select
            id="method"
            name="method"
            defaultValue="bank_transfer"
            className={inputClass()}
            {...invalid(e.method, "method")}
          >
            {Object.entries(CUSTOMER_PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id="reference"
          label="Reference"
          hint="Optional. The bank's or Stripe's."
        >
          <input
            id="reference"
            name="reference"
            maxLength={100}
            className={inputClass()}
          />
        </FormField>
        <FormField
          id="paidBy"
          label="Paid by"
          hint="Optional. If not the customer — a company, say."
        >
          <input id="paidBy" name="paidBy" maxLength={200} className={inputClass()} />
        </FormField>
        <FormField
          id="fee"
          label="Card fee"
          hint="Optional. What Stripe kept on a card payment link. Comes off profit."
          error={e.fee}
        >
          <div className="relative">
            <span
              aria-hidden
              className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
            >
              £
            </span>
            <input
              id="fee"
              name="fee"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className={inputClass("pl-7 tabular-nums")}
              {...invalid(e.fee, "fee")}
            />
          </div>
        </FormField>
        <FormField id="notes" label="Notes" hint="Optional.">
          <textarea
            id="notes"
            name="notes"
            rows={1}
            maxLength={1000}
            className={TEXTAREA_CLASS}
          />
        </FormField>
      </div>

      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Recording…">
          <Banknote aria-hidden className="h-4 w-4" />
          {picked.length ? `Record ${money(total)} paid` : "Record payment"}
        </SubmitButton>
      </div>
    </form>
  );
}
