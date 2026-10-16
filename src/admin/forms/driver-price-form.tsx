"use client";

import { useActionState, useState } from "react";

import { setDriverPriceAction } from "@/admin/actions/dispatch";
import { EMPTY_FORM } from "@/admin/form-state";
import { inputClass, invalid, SubmitButton, submitWith } from "@/components/ops/form";

import { LossWarning } from "./loss-warning";

/**
 * The driver's price for one booking: what Cityline pays the driver for it,
 * agreed per booking. Saved on its own, so it can be written or corrected at
 * any time — before the job, or after it when waiting time is added. Above
 * the booking's agreed price it warns of the loss (Cityline, 16 Oct 2026).
 */
export function DriverPriceForm({
  jobId,
  pricePence,
  customerPricePence = null,
  operator = false,
}: {
  jobId: number;
  pricePence: number | null;
  /** The booking's agreed price, for the loss warning. */
  customerPricePence?: number | null;
  /** The booking is with a subcontracting operator: the operator's price. */
  operator?: boolean;
}) {
  const [state, action, pending] = useActionState(setDriverPriceAction, EMPTY_FORM);
  const error = state.errors.driverPrice;
  const [typed, setTyped] = useState(
    pricePence === null ? "" : (pricePence / 100).toFixed(2),
  );

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-1.5">
      <input type="hidden" name="jobId" value={jobId} />
      <label htmlFor="driverPrice" className="text-ink-3 text-xs font-medium">
        {operator ? "Operator price" : "Driver price"}
      </label>
      <div className="flex items-start gap-2">
        <div className="relative w-32">
          <span
            aria-hidden
            className="text-ink-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base lg:text-sm"
          >
            £
          </span>
          <input
            id="driverPrice"
            name="driverPrice"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={pricePence === null ? "" : (pricePence / 100).toFixed(2)}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="0.00"
            className={inputClass("pl-7 tabular-nums")}
            {...invalid(error, "driverPrice")}
          />
        </div>
        <SubmitButton pending={pending} variant="secondary">
          Save
        </SubmitButton>
      </div>
      {error ? (
        <p id="driverPrice-error" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        <p className="text-ink-3 text-xs">
          What Cityline pays the {operator ? "operator" : "driver"} for this booking.
        </p>
      )}
      <LossWarning
        customerPricePence={customerPricePence}
        typed={typed}
        operator={operator}
      />
      {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
    </form>
  );
}
