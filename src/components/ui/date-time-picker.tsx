"use client";

import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Date and time pickers built on shadcn/ui (Popover + Calendar), replacing the
 * native `<input type="date">` and `<input type="time">`.
 *
 * Three things this fixes that CSS could not:
 *
 *   1. **British date order.** The native picker follows the browser's locale,
 *      so a visitor with US settings saw `mm/dd/yyyy` on a UK site. These
 *      always read `Tue 1 Dec 2026`, spelled out, which cannot be misread at
 *      all — and getting it wrong means someone missing a flight.
 *   2. **The popup is ours.** The native calendar is drawn outside the page
 *      and no stylesheet reaches it; this one uses the site's own colours,
 *      font and focus ring.
 *   3. **24-hour time**, as used in the UK for travel, with no AM/PM segment.
 *
 * The value still travels as a hidden input in ISO form (`yyyy-mm-dd`,
 * `HH:mm`), so the form remains an ordinary GET submission and everything
 * downstream — `parseFunnelParams`, the funnel, the URL — is unchanged.
 */

/** "Tue 1 Dec 2026" — unambiguous in a way 01/12/2026 is not. */
function formatUkDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function TriggerShell({
  icon,
  children,
  empty,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  empty: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-surface-container-low/70 rounded-input text-body-md flex h-12 w-full items-center gap-2.5 px-3.5 text-left transition-all",
        empty ? "text-on-surface-variant/60" : "text-on-surface",
        className,
      )}
    >
      <span className="text-primary shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

export function DatePicker({
  id,
  name,
  label,
  value,
  onChange,
  min,
  required,
  placeholder = "Pick a date",
}: {
  id: string;
  name: string;
  /** Visually hidden; the trigger's accessible name. */
  label: string;
  /** ISO `yyyy-mm-dd`, or "". */
  value: string;
  onChange: (next: string) => void;
  /** Earliest selectable date, ISO. */
  min?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  const minDate = min ? new Date(`${min}T00:00:00`) : undefined;

  return (
    <>
      {/*
        The value the form actually submits. Kept as a real input so the
        journey still travels in the query string exactly as before, and so
        `required` is enforced by the browser rather than by us.
      */}
      <input type="hidden" name={name} value={value} required={required} aria-hidden />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={value ? `${label}: ${formatUkDate(value)}` : label}
            className="focus-visible:bg-surface-container-lowest w-full rounded-[12px]"
          >
            <TriggerShell
              icon={<CalendarIcon aria-hidden className="h-5 w-5" />}
              empty={!value}
            >
              {value ? formatUkDate(value) : placeholder}
            </TriggerShell>
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            selected={selected}
            minDate={minDate}
            onSelect={(date) => {
              onChange(toIso(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

/** Every 15 minutes, 24-hour — the granularity a transfer is booked at. */
const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const hours = String(Math.floor(i / 4)).padStart(2, "0");
  const minutes = String((i % 4) * 15).padStart(2, "0");
  return `${hours}:${minutes}`;
});

export function TimePicker({
  id,
  name,
  label,
  value,
  onChange,
  required,
  placeholder = "Pick a time",
}: {
  id: string;
  name: string;
  label: string;
  /** 24-hour `HH:mm`, or "". */
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} aria-hidden />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={value ? `${label}: ${value}` : label}
            className="focus-visible:bg-surface-container-lowest w-full rounded-[12px]"
          >
            <TriggerShell icon={<Clock aria-hidden className="h-5 w-5" />} empty={!value}>
              {value || placeholder}
            </TriggerShell>
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-40 p-1">
          {/*
            A plain scrolling listbox. 96 slots is too many for a dropdown to
            feel quick, so it opens scrolled to the chosen time — or to 09:00
            when nothing is set, which is where most airport runs start.
          */}
          <ul role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
            {TIME_SLOTS.map((slot) => {
              const isSelected = slot === value;
              return (
                <li key={slot}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    ref={
                      isSelected || (!value && slot === "09:00")
                        ? (node) => node?.scrollIntoView({ block: "center" })
                        : undefined
                    }
                    onClick={() => {
                      onChange(slot);
                      setOpen(false);
                    }}
                    className={cn(
                      "text-body-sm w-full rounded-lg px-3 py-1.5 text-left tabular-nums transition-colors",
                      isSelected
                        ? "bg-primary-container text-on-primary"
                        : "hover:bg-surface-container-low hover:text-primary",
                    )}
                  >
                    {slot}
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </>
  );
}
