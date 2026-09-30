"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/admin/form-state";

import { buttonClass, cx, type ButtonVariant } from "./primitives";

/**
 * Form pieces for the operations screens (spec §7): sections, labelled fields
 * with their error beside them, and a submit button that shows it is working.
 * Validation happens in the server action; these only display its answer.
 */

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-line grid gap-4 border-t pt-5 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="text-md text-ink font-semibold">{title}</p>
        {description ? <p className="text-ink-3 mt-1 text-sm">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  wide,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={id} className="text-ink-2 mb-1 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-danger mt-1 flex items-start gap-1 text-sm">
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-ink-3 mt-1 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

const INPUT =
  "block h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink shadow-xs placeholder:text-ink-4 aria-invalid:border-danger lg:h-9 lg:text-sm";

export function inputClass(extra?: string): string {
  return cx(INPUT, extra);
}

export const TEXTAREA_CLASS =
  "block min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink shadow-xs placeholder:text-ink-4 aria-invalid:border-danger lg:text-sm";

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <div
      role="alert"
      className="border-danger-line bg-danger-soft text-danger flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
    >
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      {state.message}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  pending: pendingProp,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  /** From `useActionState`, for forms submitted with `submitWith`. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, "md")}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** See `lib/form-submit.ts`: submit without React 19's automatic form reset. */
export { submitWithoutReset as submitWith } from "@/lib/form-submit";

/** `aria-invalid` and `aria-describedby` for a control with an error. */
export function invalid(error: string | undefined, id: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}
