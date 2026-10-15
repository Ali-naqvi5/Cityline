"use client";

import { useActionState } from "react";

import { saveBankDetailsAction } from "@/admin/actions/fleet";
import { EMPTY_FORM } from "@/admin/form-state";
import {
  FormField,
  FormMessage,
  inputClass,
  SubmitButton,
  submitWith,
} from "@/components/ops/form";

/** Owner and Accounts. Sealed on the server before it is stored (spec §22). */
export function BankDetailsForm({
  driverId,
  operator = false,
  hasDetails,
}: {
  /** The driver's id, or the subcontracting operator's with `operator`. */
  driverId: number;
  operator?: boolean;
  hasDetails: boolean;
}) {
  const [state, action, pending] = useActionState(saveBankDetailsAction, EMPTY_FORM);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={submitWith(action)}
        className="grid gap-4 sm:grid-cols-3"
        autoComplete="off"
      >
        <input type="hidden" name="id" value={driverId} />
        {operator ? <input type="hidden" name="owner" value="operators" /> : null}
        <FormField id="accountName" label="Account name">
          <input
            id="accountName"
            name="accountName"
            autoComplete="off"
            className={inputClass()}
          />
        </FormField>
        <FormField id="sortCode" label="Sort code">
          <input
            id="sortCode"
            name="sortCode"
            inputMode="numeric"
            placeholder="12-34-56"
            autoComplete="off"
            className={inputClass("tabular-nums")}
          />
        </FormField>
        <FormField id="accountNumber" label="Account number">
          <input
            id="accountNumber"
            name="accountNumber"
            inputMode="numeric"
            placeholder="12345678"
            autoComplete="off"
            className={inputClass("tabular-nums")}
          />
        </FormField>
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
        <div className="sm:col-span-3">
          <SubmitButton pending={pending} variant="secondary">
            {hasDetails ? "Replace bank details" : "Save bank details"}
          </SubmitButton>
        </div>
      </form>
      {hasDetails ? (
        <form onSubmit={submitWith(action)}>
          <input type="hidden" name="id" value={driverId} />
          {operator ? <input type="hidden" name="owner" value="operators" /> : null}
          <input type="hidden" name="remove" value="1" />
          <SubmitButton pending={pending} variant="ghost" pendingLabel="Removing…">
            Remove bank details
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
