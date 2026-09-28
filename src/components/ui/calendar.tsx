"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

/**
 * A three-view date picker: days, months, then years — the pattern people know
 * from phone date pickers, where the caption is the way back out.
 *
 * Tapping the month name opens a grid of twelve months; tapping the year opens
 * a 3×3 grid of nine years. Picking from either drops back down a level. That
 * matters more than it sounds for a transfer site: a customer booking a flight
 * eleven months out would otherwise be clicking the next-month arrow eleven
 * times.
 *
 * The day grid is react-day-picker; the month and year grids are ours, because
 * react-day-picker only offers native `<select>` dropdowns for this and those
 * cannot be styled to match anything.
 *
 * `en-GB` throughout: weeks start on Monday and dates read the British way
 * round. That is the reason this exists rather than the native
 * `<input type="date">`, whose picker follows the *browser's* locale — a
 * visitor with US settings was shown `mm/dd/yyyy` on a UK site, where 12/01
 * reads as 12 January instead of 1 December, and someone misses a flight.
 */

/**
 * One scale for the whole calendar, so the three views cannot drift apart.
 * Cells were 36px; 28px is a shade over a quarter smaller, and stays above the
 * 24px minimum target size WCAG 2.2 asks for (SC 2.5.8).
 */
const CELL = "h-7 w-7";
const GRID_CELL = "h-9";

const YEARS_PER_PAGE = 9;

const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "short" });
const monthLongFormatter = new Intl.DateTimeFormat("en-GB", { month: "long" });

type View = "days" | "months" | "years";

const navButton = cn(
  "pointer-events-auto",
  "text-on-surface-variant hover:text-primary hover:bg-surface-container-low",
  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
  "disabled:pointer-events-none disabled:opacity-30",
);

/** The caption buttons that open the month and year views. */
const captionButton = cn(
  "text-title-md text-on-surface hover:text-primary rounded-lg px-1.5 py-0.5",
  "transition-colors hover:bg-surface-container-low",
);

const gridButton = cn(
  "text-body-sm rounded-lg tabular-nums transition-colors",
  "hover:bg-surface-container-low hover:text-primary",
  "disabled:pointer-events-none disabled:text-on-surface-variant/30 disabled:line-through",
);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The last moment of a month, for deciding whether it is wholly in the past. */
function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export function Calendar({
  selected,
  onSelect,
  minDate,
  className,
}: {
  selected?: Date;
  onSelect: (date: Date) => void;
  /** Earliest selectable day. Months and years wholly before it are disabled. */
  minDate?: Date;
  className?: string;
}) {
  const initial = selected ?? minDate ?? new Date();

  const [view, setView] = useState<View>("days");
  const [month, setMonth] = useState<Date>(
    new Date(initial.getFullYear(), initial.getMonth(), 1),
  );

  const year = month.getFullYear();
  const min = minDate ? startOfDay(minDate) : undefined;

  /** First year of the nine currently shown — a stable page, not a window. */
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  );

  function showMonth(next: Date) {
    setMonth(next);
    setView("days");
  }

  return (
    <div className={cn("w-54 p-2.5", className)}>
      {view === "days" ? (
        <DayPicker
          mode="single"
          autoFocus
          showOutsideDays
          weekStartsOn={1}
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          disabled={min ? { before: min } : undefined}
          onSelect={(date) => date && onSelect(date)}
          className="w-full"
          classNames={{
            months: "flex flex-col",
            month: "flex flex-col gap-3",
            month_caption: "flex items-center justify-center h-7",
            caption_label: "flex items-center gap-1",
            /*
              Absolutely positioned across the caption so the arrows sit at the
              edges with the month and year centred between them — but that box
              then covers the caption buttons and eats their clicks. The
              container ignores pointer events; the two arrows take them back.
            */
            nav: "flex items-center justify-between absolute inset-x-2.5 top-2.5 pointer-events-none",
            button_previous: navButton,
            button_next: navButton,
            month_grid: "w-full border-collapse",
            weekdays: "flex justify-between",
            weekday: cn(
              "text-on-surface-variant text-label-sm font-normal uppercase",
              CELL,
              "flex items-center justify-center",
            ),
            week: "flex justify-between w-full mt-0.5",
            day: cn(CELL, "p-0 text-center"),
            day_button: cn(
              "text-body-sm rounded-lg font-normal tabular-nums transition-colors",
              CELL,
              "hover:bg-surface-container-low hover:text-primary",
              "aria-selected:bg-primary-container aria-selected:text-on-primary",
              "aria-selected:hover:bg-primary-container aria-selected:hover:text-on-primary",
            ),
            today: "font-semibold text-primary",
            outside: "text-on-surface-variant/40",
            disabled: "text-on-surface-variant/30 pointer-events-none line-through",
            hidden: "invisible",
          }}
          components={{
            Chevron: ({ orientation, ...rest }) =>
              orientation === "left" ? (
                <ChevronLeft className="h-4 w-4" {...rest} />
              ) : (
                <ChevronRight className="h-4 w-4" {...rest} />
              ),
            /* The month and year become the way into the other two views. */
            CaptionLabel: () => (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView("months")}
                  className={captionButton}
                  aria-label={`${monthLongFormatter.format(month)}. Choose a different month`}
                >
                  {monthLongFormatter.format(month)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYearPageStart(Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE);
                    setView("years");
                  }}
                  className={cn(captionButton, "tabular-nums")}
                  aria-label={`${year}. Choose a different year`}
                >
                  {year}
                </button>
              </span>
            ),
          }}
        />
      ) : null}

      {view === "months" ? (
        <GridView
          label={String(year)}
          labelAction={() => {
            setYearPageStart(Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE);
            setView("years");
          }}
          labelHint="Choose a different year"
          onPrevious={() => setMonth(new Date(year - 1, month.getMonth(), 1))}
          onNext={() => setMonth(new Date(year + 1, month.getMonth(), 1))}
          previousLabel="Previous year"
          nextLabel="Next year"
          columns={3}
        >
          {Array.from({ length: 12 }, (_, index) => {
            const disabled = min ? endOfMonth(year, index) < min : false;
            const isCurrent = index === month.getMonth();

            return (
              <button
                key={index}
                type="button"
                disabled={disabled}
                aria-current={isCurrent ? "date" : undefined}
                onClick={() => showMonth(new Date(year, index, 1))}
                className={cn(
                  gridButton,
                  GRID_CELL,
                  isCurrent && "bg-primary-container text-on-primary",
                  isCurrent && "hover:bg-primary-container hover:text-on-primary",
                )}
              >
                {monthFormatter.format(new Date(year, index, 1))}
              </button>
            );
          })}
        </GridView>
      ) : null}

      {view === "years" ? (
        <GridView
          label={`${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}`}
          onPrevious={() => setYearPageStart(yearPageStart - YEARS_PER_PAGE)}
          onNext={() => setYearPageStart(yearPageStart + YEARS_PER_PAGE)}
          previousLabel="Earlier years"
          nextLabel="Later years"
          columns={3}
        >
          {Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
            const value = yearPageStart + index;
            const disabled = min ? endOfMonth(value, 11) < min : false;
            const isCurrent = value === year;

            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                aria-current={isCurrent ? "date" : undefined}
                onClick={() => {
                  setMonth(new Date(value, month.getMonth(), 1));
                  setView("months");
                }}
                className={cn(
                  gridButton,
                  GRID_CELL,
                  isCurrent && "bg-primary-container text-on-primary",
                  isCurrent && "hover:bg-primary-container hover:text-on-primary",
                )}
              >
                {value}
              </button>
            );
          })}
        </GridView>
      ) : null}
    </div>
  );
}

/**
 * The shared frame for the month and year grids: the same caption row and
 * arrows as the day view, so moving between the three does not feel like
 * moving between three different components.
 */
function GridView({
  label,
  labelAction,
  labelHint,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  columns,
  children,
}: {
  label: string;
  labelAction?: () => void;
  labelHint?: string;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  columns: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-7 items-center justify-between">
        <button
          type="button"
          onClick={onPrevious}
          aria-label={previousLabel}
          className={navButton}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>

        {labelAction ? (
          <button
            type="button"
            onClick={labelAction}
            aria-label={`${label}. ${labelHint}`}
            className={cn(captionButton, "tabular-nums")}
          >
            {label}
          </button>
        ) : (
          <span className="text-title-md text-on-surface tabular-nums">{label}</span>
        )}

        <button
          type="button"
          onClick={onNext}
          aria-label={nextLabel}
          className={navButton}
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}
