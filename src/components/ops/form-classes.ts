import { cx } from "./primitives";

/**
 * Class names for form controls. A plain module, not a client one, so server
 * components can use them too: anything exported from a "use client" file
 * reaches the server only as a reference, and calling it there fails.
 */

const INPUT =
  "block h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink shadow-xs placeholder:text-ink-4 aria-invalid:border-danger lg:h-9 lg:text-sm";

export function inputClass(extra?: string): string {
  return cx(INPUT, extra);
}

export const TEXTAREA_CLASS =
  "block min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink shadow-xs placeholder:text-ink-4 aria-invalid:border-danger lg:text-sm";

/** A shorter text box, for notes in a busy form. */
export const TEXTAREA_COMPACT_CLASS =
  "block min-h-16 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink shadow-xs placeholder:text-ink-4 aria-invalid:border-danger lg:text-sm";

/** `aria-invalid` and `aria-describedby` for a control with an error. */
export function invalid(error: string | undefined, id: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}
