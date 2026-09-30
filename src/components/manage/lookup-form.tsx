"use client";

import { MailCheck } from "lucide-react";
import { useActionState } from "react";

import { requestManageLinkAction } from "@/app/(public)/(manage)/manage/actions";
import { EMPTY_FORM_STATE } from "@/app/(public)/(manage)/manage/form-state";
import { Field } from "@/components/ui/field";

/**
 * "Send me my link again." The reply never says whether anything matched —
 * see `requestManageLinkAction` for why.
 */
export function LookupForm() {
  const [state, formAction, pending] = useActionState(
    requestManageLinkAction,
    EMPTY_FORM_STATE,
  );

  if (state.sent) {
    return (
      <p
        role="status"
        className="bg-surface-container-low border-outline-variant rounded-card p-space-lg text-body-lg flex gap-3 border"
      >
        <MailCheck aria-hidden className="text-primary mt-1 h-6 w-6 shrink-0" />
        <span>
          If that reference and email match a booking, we have sent the link to the email
          address on the booking. It can take a few minutes to arrive — check your junk
          folder too.
        </span>
      </p>
    );
  }

  return (
    <form action={formAction} className="gap-space-md flex max-w-md flex-col">
      <Field
        id="reference"
        name="reference"
        label="Booking reference"
        placeholder="CL-7K4Q2P"
        autoComplete="off"
        autoCapitalize="characters"
        required
        error={state.errors.reference}
      />
      <Field
        id="email"
        name="email"
        type="email"
        label="Email you booked with"
        autoComplete="email"
        required
        error={state.errors.email}
      />
      {state.message ? (
        <p
          role="alert"
          className="border-error/40 text-body-md rounded-card p-space-md border"
        >
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary-container text-on-primary hover:bg-secondary rounded-button text-label-md flex h-12 items-center justify-center px-6 font-semibold transition-colors disabled:opacity-60 sm:self-start"
      >
        {pending ? "Sending…" : "Email me the link"}
      </button>
    </form>
  );
}
