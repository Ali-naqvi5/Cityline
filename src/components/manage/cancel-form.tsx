"use client";

import Link from "next/link";
import { useActionState } from "react";

import { cancelBookingAction } from "@/app/(public)/(manage)/manage/actions";
import { EMPTY_FORM_STATE } from "@/app/(public)/(manage)/manage/form-state";

/** The confirm button for a cancellation, with a pending state (BK-07). */
export function CancelForm({
  reference,
  token,
  backHref,
}: {
  reference: string;
  token: string;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(
    cancelBookingAction,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="gap-space-md flex flex-col">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="token" value={token} />

      {state.message ? (
        <p
          role="alert"
          className="border-error/40 text-body-md rounded-card p-space-md border"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="bg-error text-on-primary rounded-button text-label-md flex h-12 items-center justify-center px-6 font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Cancel my booking"}
        </button>
        <Link href={backHref} className="text-label-md text-primary hover:underline">
          Keep my booking
        </Link>
      </div>
    </form>
  );
}
