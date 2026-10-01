"use client";

import { useActionState } from "react";

import { setDriverPriceAction } from "@/admin/actions/dispatch";
import { EMPTY_FORM } from "@/admin/form-state";
import { inputClass, invalid, SubmitButton, submitWith } from "@/components/ops/form";

/**
 * The driver's price for one booking: what Cityline pays the driver for it,
 * agreed per booking. Saved on its own, so it can be written or corrected at
 * any time — before the job, or after it when waiting time is added.
 */
export function DriverPriceForm({
  jobId,
  pricePence,
}: {
  jobId: number;
  pricePence: number | null;
}) {
  const [state, action, pending] = useActionState(setDriverPriceAction, EMPTY_FORM);
  const error = state.errors.driverPrice;

  return (
    <form onSubmit={submitWith(action)} className="flex flex-col gap-1.5">
      <input type="hidden" name="jobId" value={jobId} />
      <label htmlFor="driverPrice" className="text-ink-3 text-xs font-medium">
        Driver price
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
          What Cityline pays the driver for this booking.
        </p>
      )}
      {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
    </form>
  );
}
