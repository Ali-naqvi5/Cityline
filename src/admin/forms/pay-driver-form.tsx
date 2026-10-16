"use client";

import { Banknote } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { recordDriverPaymentAction } from "@/admin/actions/driver-pay";
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
import { cx } from "@/components/ops/primitives";
import {
  PAYMENT_METHODS,
  paymentPeriod,
  paymentPeriodStart,
} from "@/domain/finance/driver-pay";
import { formatPence, type Pence } from "@/domain/money";

export interface PayLine {
  id: number;
  reference: string;
  when: string;
  /** The pickup's London day, "YYYY-MM-DD". */
  day: string;
  route: string;
  status: string;
  pricePence: number;
  cashPence: number;
}

/** The driver's share of a partner penalty, to take off (Cityline, 16 Oct 2026). */
export interface PayPenalty {
  id: number;
  /** PN-… */
  reference: string;
  /** The booking it was for. */
  booking: string;
  when: string;
  reason: string;
  /** The driver's share. */
  amountPence: number;
}

const money = (pence: number) => formatPence(pence as Pence);

/**
 * Paying a driver for their done, priced bookings up to the chosen day, less
 * their share of partner penalties not yet taken off. All are ticked to
 * start with; the totals follow the ticks, and so does the period it covers
 * — from the day after the driver's last payment. The server works the
 * payment out again from the bookings and penalties themselves when it saves.
 */
const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);

export function PayDriverForm({
  payee,
  driverName,
  upTo,
  previousUpTo,
  today,
  lines,
  penalties = [],
}: {
  /** Who is paid: a driver, or a subcontracting operator. */
  payee: { kind: "driver" | "operator"; id: number };
  driverName: string;
  upTo: string;
  /** The day the driver's last payment ran up to, if they have one. */
  previousUpTo: string | null;
  today: string;
  lines: PayLine[];
  penalties?: PayPenalty[];
}) {
  const [state, action, pending] = useActionState(recordDriverPaymentAction, EMPTY_FORM);
  const [method, setMethod] = useState("bank_transfer");
  const [chosen, setChosen] = useState<Set<number>>(
    () => new Set(lines.map((line) => line.id)),
  );
  const [deducted, setDeducted] = useState<Set<number>>(
    () => new Set(penalties.map((penalty) => penalty.id)),
  );
  const picked = lines.filter((line) => chosen.has(line.id));
  const pickedPenalties = penalties.filter((penalty) => deducted.has(penalty.id));
  const earned = picked.reduce((sum, line) => sum + line.pricePence, 0);
  const cash = picked.reduce((sum, line) => sum + line.cashPence, 0);
  const less = pickedPenalties.reduce((sum, penalty) => sum + penalty.amountPence, 0);
  const net = earned - cash - less;
  // Penalties alone cover no bookings: such a payment starts on its own day.
  const firstDay =
    picked.map((line) => line.day).sort()[0] ?? (pickedPenalties.length ? upTo : null);
  const covers = firstDay
    ? paymentPeriod(
        noonOf(paymentPeriodStart({ upTo, previousUpTo, firstBooking: firstDay })),
        noonOf(upTo),
      )
    : null;
  const toggleDeducted = (id: number) =>
    setDeducted((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggle = (id: number) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <input type="hidden" name="payeeKind" value={payee.kind} />
      <input type="hidden" name="payeeId" value={payee.id} />
      <input type="hidden" name="upTo" value={upTo} />

      {/* A fieldset is as wide as its content unless told otherwise. */}
      <fieldset className={cx("min-w-0", lines.length === 0 && "hidden")}>
        <legend className="sr-only">Bookings to pay for</legend>
        <div className="text-ink-3 mb-2 flex items-center justify-between gap-3 text-xs">
          <span>
            {picked.length} of {lines.length} chosen
          </span>
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() =>
              setChosen(
                picked.length === lines.length
                  ? new Set()
                  : new Set(lines.map((line) => line.id)),
              )
            }
          >
            {picked.length === lines.length ? "Untick all" : "Tick all"}
          </button>
        </div>
        <ul className="border-line divide-line divide-y rounded-md border">
          {lines.map((line) => (
            <li key={line.id}>
              <label
                htmlFor={`pay-${line.id}`}
                className={cx(
                  "flex cursor-pointer items-start gap-3 px-3 py-2.5",
                  chosen.has(line.id) ? "bg-accent-soft/50" : "hover:bg-sunken",
                )}
              >
                <input
                  id={`pay-${line.id}`}
                  type="checkbox"
                  name="job"
                  value={line.id}
                  checked={chosen.has(line.id)}
                  onChange={() => toggle(line.id)}
                  className="accent-accent mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="text-ink font-medium tabular-nums">{line.when}</span>
                  <span className="text-ink-3">
                    {" "}
                    · {line.reference} · {line.status}
                  </span>
                  <span className="text-ink-2 block truncate">{line.route}</span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="text-ink block font-medium">
                    {money(line.pricePence)}
                  </span>
                  {line.cashPence ? (
                    <span className="text-warn block text-xs">
                      cash {money(line.cashPence)}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {state.errors.jobs ? (
          <p className="text-danger mt-1 text-sm">{state.errors.jobs}</p>
        ) : null}
      </fieldset>

      {penalties.length ? (
        <fieldset className="min-w-0">
          <legend className="text-ink-2 mb-2 text-sm font-medium">
            Partner penalties to take off
          </legend>
          <ul className="border-line divide-line divide-y rounded-md border">
            {penalties.map((penalty) => (
              <li key={penalty.id}>
                <label
                  htmlFor={`deduct-${penalty.id}`}
                  className={cx(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5",
                    deducted.has(penalty.id) ? "bg-accent-soft/50" : "hover:bg-sunken",
                  )}
                >
                  <input
                    id={`deduct-${penalty.id}`}
                    type="checkbox"
                    name="penalty"
                    value={penalty.id}
                    checked={deducted.has(penalty.id)}
                    onChange={() => toggleDeducted(penalty.id)}
                    className="accent-accent mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="text-ink font-medium tabular-nums">
                      {penalty.when}
                    </span>
                    <span className="text-ink-3">
                      {" "}
                      · {penalty.reference} · {penalty.booking}
                    </span>
                    <span className="text-ink-2 block truncate">{penalty.reason}</span>
                  </span>
                  <span className="text-danger shrink-0 text-sm font-medium tabular-nums">
                    {money(-penalty.amountPence)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {state.errors.penalties ? (
            <p className="text-danger mt-1 text-sm">{state.errors.penalties}</p>
          ) : null}
        </fieldset>
      ) : null}

      <dl className="border-line grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border p-3 text-sm tabular-nums">
        {covers ? (
          <>
            <dt className="text-ink-3">Covers</dt>
            <dd className="text-right">{covers}</dd>
          </>
        ) : null}
        <dt className="text-ink-3">Driver prices</dt>
        <dd className="text-right">{money(earned)}</dd>
        <dt className="text-ink-3">Less cash {driverName} collected</dt>
        <dd className="text-right">{cash ? `-${money(cash)}` : money(0)}</dd>
        {penalties.length ? (
          <>
            <dt className="text-ink-3">Less penalties</dt>
            <dd className="text-right">{less ? `-${money(less)}` : money(0)}</dd>
          </>
        ) : null}
        <dt className="text-ink font-semibold">
          {net >= 0 ? "To pay" : `${driverName} owes Cityline`}
        </dt>
        <dd className="text-ink text-right text-base font-semibold">
          {money(Math.abs(net))}
        </dd>
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="paidAt" label="Date paid" required error={state.errors.paidAt}>
          <input
            id="paidAt"
            name="paidAt"
            type="date"
            defaultValue={today}
            className={inputClass()}
            {...invalid(state.errors.paidAt, "paidAt")}
          />
        </FormField>
        <FormField id="method" label="How" required error={state.errors.method}>
          <select
            id="method"
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className={inputClass()}
          >
            {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="reference" label="Bank reference" hint="Optional.">
          <input
            id="reference"
            name="reference"
            maxLength={100}
            className={inputClass()}
          />
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
        {method === "bank_transfer" ? (
          <FormField
            id="receipt"
            label="Bank transfer receipt"
            hint="Optional. A photo or screenshot (JPG, PNG or WebP, up to 10 MB). It goes on its own last page of the statement."
            error={state.errors.receipt}
            wide
          >
            <input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-ink-2 file:border-line file:bg-surface file:text-ink hover:file:bg-sunken w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
              {...invalid(state.errors.receipt, "receipt")}
            />
          </FormField>
        ) : null}
      </div>

      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingLabel="Recording…">
          <Banknote aria-hidden className="h-4 w-4" />
          {net >= 0
            ? `Record payment of ${money(net)}`
            : `Record ${money(-net)} paid by ${driverName}`}
        </SubmitButton>
        <Link href="/admin/driver-pay" className="text-ink-3 text-sm hover:underline">
          Back to Driver Pay
        </Link>
      </div>
    </form>
  );
}
