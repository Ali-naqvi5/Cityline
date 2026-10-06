import { formatPence, type Pence } from "@/domain/money";

import { cx } from "../primitives";

import { niceMax } from "./scale";

export interface MoneyPoint {
  key: string;
  /** The read-out's label: "Thu 1 Oct", "w/c 28 Sept" or "Oct 2026". */
  label: string;
  /** The axis label, if shorter: "1 Oct", "28 Sept", "Oct". */
  short?: string;
  /** Pence; below zero is a loss. */
  value: number;
  /** What the hover read-out says under the value. */
  tip?: string;
}

const money = (pence: number) => formatPence(pence as Pence);

/** "£1.5k", "£300", "-£80" — short, for the axis only. */
function axisMoney(pence: number): string {
  const pounds = Math.abs(pence) / 100;
  const sign = pence < 0 ? "-" : "";
  if (pounds >= 1000) {
    const thousands = pounds / 1000;
    return `${sign}£${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return `${sign}£${Math.round(pounds)}`;
}

/**
 * Money over time as columns — one series, profit, so no legend. Above the
 * line in the chart colour; a loss hangs below it in the danger colour, so a
 * bad day reads as one without a key. Every value is in its hover read-out
 * and in the table beside the chart.
 */
export function MoneyColumns({ points }: { points: readonly MoneyPoint[] }) {
  const high = Math.max(0, ...points.map((point) => point.value));
  const low = Math.min(0, ...points.map((point) => point.value));
  const up = high > 0 ? niceMax(high) : 0;
  const down = low < 0 ? niceMax(-low) : 0;
  const span = up + down || 1;
  const zero = (up / span) * 100;
  const ticks = [
    { value: up, top: 0 },
    ...(up && down ? [{ value: 0, top: zero }] : []),
    { value: -down, top: 100 },
  ];
  const every = Math.max(1, Math.ceil(points.length / 10));
  const labelled = (index: number) => index % every === 0;
  const phoneLabelled = (index: number) => index % (every * 2) === 0;

  return (
    <div className="flex gap-2">
      <div
        aria-hidden
        className="text-ink-3 relative h-44 w-11 shrink-0 text-right text-xs"
      >
        {ticks.map((tick) => (
          <span
            key={`${tick.value}-${tick.top}`}
            className="absolute right-0 -translate-y-1/2 leading-none tabular-nums"
            style={{ top: `${tick.top}%` }}
          >
            {axisMoney(tick.value)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-44">
          {ticks.map((tick) => (
            <div
              key={`${tick.value}-${tick.top}`}
              aria-hidden
              className={cx(
                "absolute inset-x-0 border-t",
                tick.value === 0 ? "border-ink-3" : "border-line",
              )}
              style={{ top: `${tick.top}%` }}
            />
          ))}
          <ol className="absolute inset-0 flex gap-[2px]">
            {points.map((point) => (
              <li
                key={point.key}
                tabIndex={0}
                data-tip-value={money(point.value)}
                data-tip-label={point.tip ?? point.label}
                aria-label={`${point.label}: ${money(point.value)}`}
                className="group relative flex h-full min-w-0 flex-1 justify-center rounded-xs outline-offset-2"
              >
                <span
                  aria-hidden
                  className={cx(
                    "absolute w-full max-w-6 transition-opacity group-hover:opacity-80",
                    point.value < 0
                      ? "bg-danger rounded-b-[4px]"
                      : "bg-viz rounded-t-[4px]",
                  )}
                  style={
                    point.value < 0
                      ? {
                          top: `${zero}%`,
                          height: `${(-point.value / span) * 100}%`,
                          minHeight: 2,
                        }
                      : {
                          bottom: `${100 - zero}%`,
                          height: `${(point.value / span) * 100}%`,
                          minHeight: point.value ? 2 : 0,
                        }
                  }
                />
              </li>
            ))}
          </ol>
        </div>
        <ol aria-hidden className="text-ink-3 mt-1.5 flex gap-[2px] text-xs">
          {points.map((point, index) => (
            <li
              key={point.key}
              className={cx(
                "min-w-0 flex-1 text-center whitespace-nowrap",
                !phoneLabelled(index) && "max-sm:invisible",
              )}
            >
              {labelled(index) ? (point.short ?? point.label) : ""}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
