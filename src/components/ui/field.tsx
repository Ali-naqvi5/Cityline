import type { ComponentProps, ReactNode } from "react";

/**
 * A labelled form control, per DESIGN.md "Form Inputs": white, 48px tall,
 * 12px radius, 1px outline, with the focus state carrying an ambient glow.
 *
 * Label, hint and error are wired to the input with `htmlFor`, `aria-describedby`
 * and `aria-invalid` so screen readers announce them together (NFR-05) — a
 * validation message a sighted user can see but a blind user cannot is not a
 * validation message.
 */
const CONTROL =
  "bg-surface-container-lowest border-outline-variant text-on-surface " +
  "placeholder:text-on-surface-variant/60 rounded-input h-12 w-full border px-3.5 " +
  "focus:border-primary-container focus:ring-4 focus:ring-primary-container/12 " +
  "focus:outline-none transition-all " +
  "aria-[invalid=true]:border-error aria-[invalid=true]:ring-error/12";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Icon rendered inside the control, on the left. */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  icon,
  children,
  className = "",
  ...inputProps
}: FieldShellProps & Omit<ComponentProps<"input">, "id" | "className">) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="text-label-md text-on-surface mb-1.5 block">
        {label}
        {required ? (
          <span className="text-error ml-0.5" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-on-surface-variant ml-1.5 font-normal">optional</span>
        )}
      </label>

      <div className="relative flex items-center">
        {icon ? (
          <span
            aria-hidden
            className="text-primary pointer-events-none absolute left-3.5 flex items-center"
          >
            {icon}
          </span>
        ) : null}

        {children ?? (
          <input
            id={id}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${CONTROL} ${icon ? "pl-11" : ""}`}
            {...inputProps}
          />
        )}
      </div>

      {hint ? (
        <p id={hintId} className="text-body-sm text-on-surface-variant mt-1.5">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-body-sm text-error mt-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const fieldControlClasses = CONTROL;
