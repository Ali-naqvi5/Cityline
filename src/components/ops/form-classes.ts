import { cx } from "./primitives";

/**
 * Class names for form controls. A plain module, not a client one, so server
 * components can use them too: anything exported from a "use client" file
 * reaches the server only as a reference, and calling it there fails.
 */

/**
 * Filled, not outlined (Cityline's design, 9 Oct 2026): a soft well that
 * turns white with a green edge while it is in use.
 */
const FIELD =
  "rounded-lg border border-transparent bg-field text-ink placeholder:text-ink-4 transition-colors hover:border-line-strong focus:border-accent focus:bg-surface aria-invalid:border-danger";

const INPUT = `block h-10 w-full px-3 text-base lg:h-9 lg:text-sm ${FIELD}`;

export function inputClass(extra?: string): string {
  return cx(INPUT, extra);
}

export const TEXTAREA_CLASS = `block min-h-24 w-full px-3 py-2 text-base lg:text-sm ${FIELD}`;

/** A shorter text box, for notes in a busy form. */
export const TEXTAREA_COMPACT_CLASS = `block min-h-16 w-full px-3 py-2 text-base lg:text-sm ${FIELD}`;

/** `aria-invalid` and `aria-describedby` for a control with an error. */
export function invalid(error: string | undefined, id: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}
