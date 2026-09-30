import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cx } from "./primitives";

/** Compact, consistent form controls for filter bars and forms (spec §7). */

const CONTROL =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink shadow-xs placeholder:text-ink-4 lg:h-9 lg:text-sm";

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-ink-3 mb-1 block text-xs font-medium">
      {children}
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cx(CONTROL, "pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  id,
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="text-ink-2 flex h-10 cursor-pointer items-center gap-2 text-sm whitespace-nowrap lg:h-9"
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 accent-[var(--color-accent)]"
        {...props}
      />
      {label}
    </label>
  );
}
