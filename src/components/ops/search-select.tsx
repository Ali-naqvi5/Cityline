"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import { rankMatches } from "@/domain/dispatch/search";

import { inputClass } from "./form-classes";
import { cx } from "./primitives";

export interface SearchOption {
  value: string;
  label: string;
  /** A second line: a car, a phone number. Searched too. */
  detail?: string;
  /** More words that should find it: a model, a registration. */
  keywords?: string[];
  /** Shown beside the label: "Outsourced", "Off the road". */
  badge?: ReactNode;
}

/**
 * Pick one thing, or several, from a long list by typing what you remember
 * of it — a name, part of a registration, a model. Scales to a fleet of a
 * thousand without a wall of checkboxes: only the closest matches are listed.
 * Arrow keys and Enter work; the chosen values are posted as hidden inputs
 * named `name`.
 */
export function SearchSelect({
  id,
  name,
  options,
  value,
  onChange,
  multiple = false,
  placeholder = "Type to search",
  limit = 40,
  invalid = false,
  describedBy,
}: {
  id: string;
  name?: string;
  options: readonly SearchOption[];
  value: string | readonly string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  limit?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const chosen = useMemo(
    () => (Array.isArray(value) ? value : value ? [value as string] : []),
    [value],
  );
  const byValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );
  const single = !multiple ? byValue.get(chosen[0] ?? "") : undefined;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(
    () =>
      rankMatches(options, query, (option) => [
        option.label,
        option.detail ?? "",
        ...(option.keywords ?? []),
      ])
        .filter((option) => !multiple || !chosen.includes(option.value))
        .slice(0, limit),
    [options, query, multiple, chosen, limit],
  );

  const pick = (option: SearchOption) => {
    if (multiple) {
      onChange([...chosen, option.value]);
      setQuery("");
      setActive(0);
      input.current?.focus();
    } else {
      onChange(option.value);
      setQuery("");
      setOpen(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (open && matches[active]) {
        event.preventDefault();
        pick(matches[active]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && multiple && !query && chosen.length) {
      onChange(chosen.slice(0, -1));
    }
  };

  return (
    <div className="relative">
      {name
        ? chosen.map((item) => (
            <input key={item} type="hidden" name={name} value={item} />
          ))
        : null}
      {multiple && chosen.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Chosen">
          {chosen.map((item) => {
            const option = byValue.get(item);
            return (
              <li
                key={item}
                className="border-line bg-sunken text-ink inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-sm"
              >
                {option?.label ?? item}
                <button
                  type="button"
                  onClick={() => onChange(chosen.filter((other) => other !== item))}
                  className="text-ink-3 hover:text-ink rounded-full p-0.5"
                  aria-label={`Remove ${option?.label ?? item}`}
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="relative">
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={
            open && matches[active] ? `${listId}-${active}` : undefined
          }
          value={open || multiple || !single ? query : single.label}
          placeholder={single && !open ? single.label : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={inputClass("pr-9")}
        />
        <ChevronsUpDown
          aria-hidden
          className="text-ink-4 pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
        />
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          className="border-line bg-surface absolute inset-x-0 z-30 mt-1 max-h-72 overflow-auto rounded-md border p-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="text-ink-3 px-3 py-2 text-sm">Nothing matches.</li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={chosen.includes(option.value)}
                // Picked on mouse down, before the input loses focus.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={cx(
                  "flex cursor-pointer items-start gap-2 rounded px-2.5 py-2 text-sm",
                  index === active ? "bg-accent-soft" : "",
                )}
              >
                <Check
                  aria-hidden
                  className={cx(
                    "text-accent mt-0.5 h-4 w-4 shrink-0",
                    chosen.includes(option.value) ? "" : "invisible",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-ink flex flex-wrap items-center gap-1.5 font-medium">
                    {option.label}
                    {option.badge}
                  </span>
                  {option.detail ? (
                    <span className="text-ink-3 block truncate text-xs">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
