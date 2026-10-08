"use client";

import { Minus, Plus } from "lucide-react";

import { cx } from "./primitives";

/**
 * A small count — passengers, bags, child seats — with − and + either side.
 * The number can be typed as well; it posts with the form as `name`.
 */
export function Stepper({
  id,
  name,
  value,
  onChange,
  min = 0,
  max = 99,
  invalid = false,
  describedBy,
  label,
}: {
  id: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  invalid?: boolean;
  describedBy?: string;
  /** Read by screen readers on the buttons: "passengers". */
  label: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const button =
    "text-ink-2 hover:bg-accent-soft hover:text-accent flex h-full w-9 shrink-0 items-center justify-center disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div
      className={cx(
        "bg-field focus-within:border-accent focus-within:bg-surface flex h-10 items-stretch overflow-hidden rounded-lg border transition-colors lg:h-9",
        invalid ? "border-danger" : "hover:border-line-strong border-transparent",
      )}
    >
      <button
        type="button"
        className={button}
        aria-label={`Fewer ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <input
        id={id}
        name={name}
        inputMode="numeric"
        value={String(value)}
        onChange={(event) => {
          const next = Number(event.target.value.replace(/\D/g, "") || 0);
          onChange(clamp(next));
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="text-ink w-full min-w-0 border-x-0 bg-transparent text-center text-base font-medium tabular-nums lg:text-sm"
      />
      <button
        type="button"
        className={button}
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
