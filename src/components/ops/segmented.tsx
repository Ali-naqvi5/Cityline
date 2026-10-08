"use client";

import { cx } from "./primitives";

/**
 * One choice from a few, shown side by side — point to point or hourly, a
 * vehicle class. Radio buttons underneath, so it posts with the form and
 * the arrow keys move between options.
 */
export function Segmented({
  name,
  legend,
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  name: string;
  legend: string;
  options: readonly { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <fieldset className={cx("min-w-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="bg-sunken inline-flex max-w-full flex-wrap gap-1 rounded-lg p-1">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const active = option.value === value;
          return (
            <label
              key={option.value}
              htmlFor={id}
              title={option.hint}
              className={cx(
                "cursor-pointer rounded-md font-medium whitespace-nowrap transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1",
                size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
                active
                  ? "bg-accent text-on-solid shadow-xs"
                  : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
