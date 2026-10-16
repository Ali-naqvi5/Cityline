"use client";

import { Gavel } from "lucide-react";
import { useActionState, useState } from "react";

import { recordPenaltyAction } from "@/admin/actions/penalties";
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
import { formatPence, parsePounds, type Pence } from "@/domain/money";

const money = (pence: number) => formatPence(pence as Pence);

/** A pounds box with the £ inside it. */
function PoundsInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
      >
        £
      </span>
      <input
        id={id}
        name={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass("pl-7 tabular-nums")}
        {...invalid(error, id)}
      />
    </div>
  );
}

/**
 * Recording a penalty a partner took off what it pays (Cityline, 16 Oct
 * 2026) — always by hand. On a partner booking's page the booking is that
 * one; on the partner's Supplier Money page it is typed in, by our reference
 * or theirs. Part or all of it may be taken from the driver or operator who
 * did the booking, off their next Driver Pay; the rest Cityline bears.
 */
export function PenaltyForm({
  jobId,
  supplierId,
  today,
  takenFrom,
}: {
  /** On a booking's page: that booking. */
  jobId?: number;
  /** On the partner's page: the partner, and the booking is typed in. */
  supplierId?: number;
  today: string;
  /**
   * Who a share would come from: the booking's driver or operator by name;
   * null when nobody did it; undefined when not known yet (partner's page).
   */
  takenFrom?: string | null;
}) {
  const [state, action, pending] = useActionState(recordPenaltyAction, EMPTY_FORM);
  const [amount, setAmount] = useState("");
  const [share, setShare] = useState("");
  const e = state.errors;
  const fromPartner = jobId === undefined;
  const amountPence = parsePounds(amount) ?? 0;
  const sharePence = Math.min(Math.max(parsePounds(share) ?? 0, 0), amountPence);
  const who = takenFrom ?? "the driver or operator";

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="from" value={fromPartner ? "partner" : "job"} />
      {jobId !== undefined ? <input type="hidden" name="jobId" value={jobId} /> : null}
      {supplierId !== undefined ? (
        <input type="hidden" name="supplierId" value={supplierId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fromPartner ? (
          <FormField
            id="booking"
            label="Booking"
            required
            hint="Our reference (J-…) or the partner's."
            error={e.booking}
            wide
          >
            <input
              id="booking"
              name="booking"
              autoComplete="off"
              className={inputClass()}
              {...invalid(e.booking, "booking")}
            />
          </FormField>
        ) : null}
        <FormField id="amount" label="Penalty" required error={e.amount}>
          <PoundsInput id="amount" value={amount} onChange={setAmount} error={e.amount} />
        </FormField>
        <FormField id="penalisedAt" label="Date" required error={e.penalisedAt}>
          <input
            id="penalisedAt"
            name="penalisedAt"
            type="date"
            defaultValue={today}
            className={inputClass()}
            {...invalid(e.penalisedAt, "penalisedAt")}
          />
        </FormField>
        <FormField id="reason" label="What for" required error={e.reason} wide>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            maxLength={1000}
            className={TEXTAREA_CLASS}
            {...invalid(e.reason, "reason")}
          />
        </FormField>
        <FormField id="partnerReference" label="Their reference" hint="Optional.">
          <input
            id="partnerReference"
            name="partnerReference"
            maxLength={100}
            autoComplete="off"
            className={inputClass()}
          />
        </FormField>
        {takenFrom === null ? null : (
          <FormField
            id="driverShare"
            label={`Take from ${who}`}
            hint="Optional. Up to the penalty; it comes off their next Driver Pay."
            error={e.driverShare}
          >
            <PoundsInput
              id="driverShare"
              value={share}
              onChange={setShare}
              error={e.driverShare}
            />
          </FormField>
        )}
      </div>

      {amountPence > 0 ? (
        <p className="text-ink-2 text-sm">
          Cityline bears <strong>{money(amountPence - sharePence)}</strong>
          {sharePence ? (
            <>
              {" "}
              and {who} <strong>{money(sharePence)}</strong>
            </>
          ) : null}
          . It comes off what the partner owes, and off profit.
        </p>
      ) : null}

      <FormMessage state={state} />
      <div>
        <SubmitButton pending={pending} pendingLabel="Recording…">
          <Gavel aria-hidden className="h-4 w-4" />
          {amountPence > 0 ? `Record ${money(amountPence)} penalty` : "Record penalty"}
        </SubmitButton>
      </div>
    </form>
  );
}
