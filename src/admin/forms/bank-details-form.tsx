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

/** Owner only. Sealed on the server before it is stored (spec §22). */
export function BankDetailsForm({
  driverId,
  hasDetails,
}: {
  driverId: number;
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
          <input type="hidden" name="remove" value="1" />
          <SubmitButton pending={pending} variant="ghost" pendingLabel="Removing…">
            Remove bank details
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
