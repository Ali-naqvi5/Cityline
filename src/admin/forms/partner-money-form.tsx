"use client";

import { Banknote, FileText } from "lucide-react";
import { useActionState, useState } from "react";

import { partnerMoneyAction } from "@/admin/actions/supplier-money";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  inputClass,
  invalid,
  submitWith,
} from "@/components/ops/form";
import { Badge, buttonClass, cx } from "@/components/ops/primitives";
import { RECEIPT_METHODS } from "@/domain/finance/supplier-money";
import { formatPence, type Pence } from "@/domain/money";

export interface PartnerLine {
  id: number;
  reference: string;
  supplierReference: string | null;
  when: string;
  route: string;
  status: string;
  amountPence: number;
  invoice: string | null;
  due: string;
  overdue: boolean;
}

const money = (pence: number) => formatPence(pence as Pence);

/**
 * What a partner owes, ticked to start with: record money that came in for
 * the ticked bookings, or make an invoice for them. Making an invoice only
 * makes it — the office sends it, if and when it chooses.
 */
export function PartnerMoneyForm({
  supplierId,
  upTo,
  today,
  lines,
}: {
  supplierId: number;
  upTo: string;
  today: string;
  lines: PartnerLine[];
}) {
  const [state, action, pending] = useActionState(partnerMoneyAction, EMPTY_FORM);
  const [chosen, setChosen] = useState<Set<number>>(
    () => new Set(lines.map((line) => line.id)),
  );
  const picked = lines.filter((line) => chosen.has(line.id));
  const total = picked.reduce((sum, line) => sum + line.amountPence, 0);
  const alreadyInvoiced = picked.filter((line) => line.invoice).length;
  const toggle = (id: number) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4">
      <input type="hidden" name="supplierId" value={supplierId} />
      <input type="hidden" name="upTo" value={upTo} />

      {/* A fieldset is as wide as its content unless told otherwise. */}
      <fieldset className="min-w-0">
        <legend className="sr-only">Bookings</legend>
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
                htmlFor={`owed-${line.id}`}
                className={cx(
                  "flex cursor-pointer items-start gap-3 px-3 py-2.5",
                  chosen.has(line.id) ? "bg-accent-soft/50" : "hover:bg-sunken",
                )}
              >
                <input
                  id={`owed-${line.id}`}
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
                    · {line.reference}
                    {line.supplierReference ? ` · ${line.supplierReference}` : ""} ·{" "}
                    {line.status}
                  </span>
                  <span className="text-ink-2 block truncate">{line.route}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                    {line.invoice ? <Badge tone="info">{line.invoice}</Badge> : null}
                    <span className={line.overdue ? "text-danger" : "text-ink-3"}>
                      {line.overdue ? `Overdue since ${line.due}` : `Due ${line.due}`}
                    </span>
                  </span>
                </span>
                <span className="text-ink shrink-0 text-sm font-medium tabular-nums">
                  {money(line.amountPence)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {state.errors.jobs ? (
          <p className="text-danger mt-1 text-sm">{state.errors.jobs}</p>
        ) : null}
      </fieldset>

      <p className="border-line flex items-baseline justify-between rounded-md border p-3 text-sm">
        <span className="text-ink font-semibold">Ticked</span>
        <span className="text-ink text-base font-semibold tabular-nums">
          {money(total)}
        </span>
      </p>

      <FormMessage state={state} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border-line flex flex-col gap-3 rounded-md border p-3">
          <h3 className="text-ink text-sm font-semibold">Money received</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              id="receivedAt"
              label="Date received"
              error={state.errors.receivedAt}
            >
              <input
                id="receivedAt"
                name="receivedAt"
                type="date"
                defaultValue={today}
                className={inputClass()}
                {...invalid(state.errors.receivedAt, "receivedAt")}
              />
            </FormField>
            <FormField id="method" label="How" error={state.errors.method}>
              <select
                id="method"
                name="method"
                defaultValue="bank_transfer"
                className={inputClass()}
              >
                {Object.entries(RECEIPT_METHODS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="reference" label="Their reference" hint="Optional.">
              <input
                id="reference"
                name="reference"
                maxLength={100}
                className={inputClass()}
              />
            </FormField>
          </div>
          <div>
            <button
              type="submit"
              name="intent"
              value="receipt"
              disabled={pending || picked.length === 0}
              className={buttonClass("primary", "md")}
            >
              <Banknote aria-hidden className="h-4 w-4" />
              Record {money(total)} received
            </button>
          </div>
        </section>

        <section className="border-line flex flex-col gap-3 rounded-md border p-3">
          <h3 className="text-ink text-sm font-semibold">Invoice</h3>
          <p className="text-ink-3 text-xs">
            Makes the invoice and its PDF. Nothing is sent — download it and send it
            yourself, then mark it sent.
          </p>
          <FormField id="issuedAt" label="Invoice date" error={state.errors.issuedAt}>
            <input
              id="issuedAt"
              name="issuedAt"
              type="date"
              defaultValue={today}
              className={inputClass()}
              {...invalid(state.errors.issuedAt, "issuedAt")}
            />
          </FormField>
          {alreadyInvoiced ? (
            <p className="text-warn text-xs">
              {alreadyInvoiced} ticked{" "}
              {alreadyInvoiced === 1 ? "booking is" : "bookings are"} already on an
              invoice. Untick {alreadyInvoiced === 1 ? "it" : "them"} to make a new one.
            </p>
          ) : null}
          <div>
            <button
              type="submit"
              name="intent"
              value="invoice"
              disabled={pending || picked.length === 0 || alreadyInvoiced > 0}
              className={buttonClass("secondary", "md")}
            >
              <FileText aria-hidden className="h-4 w-4" />
              Create invoice for {money(total)}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
