"use client";

import { X } from "lucide-react";
import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";

import { EMPTY_FORM, type FormState } from "@/admin/form-state";

import { FormMessage, SubmitButton, submitWith } from "./form";
import { buttonClass, type ButtonVariant } from "./primitives";

/**
 * A button that asks first (spec §48). The dialog says what will happen and
 * to whom; the action runs only from its confirm button, and an error from
 * the server stays in the dialog beside the choice that caused it.
 *
 * A native `<dialog>`: focus moves into it and back, Escape closes it, and
 * the page behind cannot be clicked — without a library.
 */
export function ConfirmDialog({
  label,
  icon,
  variant = "secondary",
  title,
  children,
  confirmLabel,
  confirmVariant = "primary",
  pendingLabel = "Working…",
  action,
  fields,
}: {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  pendingLabel?: string;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Hidden values the action needs, such as the job's id. */
  fields: Record<string, string | number>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, dispatch, pending] = useActionState(action, EMPTY_FORM);

  // Reopen on an error, so it is seen even if the dialog was closed meanwhile.
  useEffect(() => {
    const open = dialog.current?.open;
    if (!open && (state.message || Object.keys(state.errors).length)) {
      dialog.current?.showModal();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        className={buttonClass(variant, "md")}
        onClick={() => dialog.current?.showModal()}
      >
        {icon}
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="ops-root bg-surface text-ink m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-0 shadow-lg backdrop:bg-black/40"
      >
        <form onSubmit={submitWith(dispatch)} className="flex flex-col gap-4 p-5">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-ink text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              className={buttonClass("ghost", "sm", "-mt-1 -mr-2 px-2")}
              onClick={() => dialog.current?.close()}
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
          <div className="text-ink-2 flex flex-col gap-3 text-sm">{children}</div>
          {state.errors.reason ? (
            <p className="text-danger text-sm">{state.errors.reason}</p>
          ) : null}
          <FormMessage state={state} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={buttonClass("secondary", "md")}
              onClick={() => dialog.current?.close()}
            >
              Go back
            </button>
            <SubmitButton
              pending={pending}
              variant={confirmVariant}
              pendingLabel={pendingLabel}
            >
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * A one-click action that is not destructive — "Driver confirmed" — with any
 * refusal from the server shown beneath it.
 */
export function ActionButton({
  label,
  icon,
  variant = "secondary",
  pendingLabel = "Saving…",
  action,
  fields,
}: {
  label: string;
  icon?: ReactNode;
  variant?: ButtonVariant;
  pendingLabel?: string;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string | number>;
}) {
  const [state, dispatch, pending] = useActionState(action, EMPTY_FORM);
  return (
    <form onSubmit={submitWith(dispatch)} className="flex flex-col gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton pending={pending} variant={variant} pendingLabel={pendingLabel}>
        {icon}
        {label}
      </SubmitButton>
      {state.message ? (
        <p className="text-danger max-w-xs text-sm">{state.message}</p>
      ) : null}
    </form>
  );
}
