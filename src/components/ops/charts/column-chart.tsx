import { cx } from "../primitives";

import { counted, niceMax } from "./scale";

export interface ColumnPoint {
  key: string;
  /** The axis label: "Thu 1 Oct" or "w/c 28 Sept". */
  label: string;
  value: number;
  /** What the hover read-out says under the value. */
  tip?: string;
}

/**
 * Volume over time as columns — one series, so no legend: the panel title
 * names it. Thin columns with rounded tops on a hairline grid; the peak is
 * labelled, every other value is in its read-out and in the numbers below.
 */
export function ColumnChart({
  points,
  singular = "booking",
}: {
  points: readonly ColumnPoint[];
  singular?: string;
}) {
  const peak = Math.max(0, ...points.map((point) => point.value));
  const max = niceMax(peak);
  const ticks = [max, max / 2, 0];
  // At most about ten axis labels, so they never collide; a phone shows half.
  const every = Math.max(1, Math.ceil(points.length / 10));
  const labelled = (index: number) => index % every === 0;
  const phoneLabelled = (index: number) => index % (every * 2) === 0;
  const peakIndex = peak > 0 ? points.findIndex((point) => point.value === peak) : -1;

  return (
    <div className="flex gap-2">
      <div
        aria-hidden
        className="text-ink-3 flex h-44 flex-col justify-between text-right text-xs tabular-nums"
      >
        {ticks.map((tick) => (
          <span key={tick} className="leading-none">
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-44">
          {ticks.map((tick, index) => (
            <div
              key={tick}
              aria-hidden
              className="border-line absolute inset-x-0 border-t"
              style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <ol className="absolute inset-0 flex items-end gap-[2px]">
            {points.map((point, index) => (
              // The whole column slot is the hover and focus target, not just
              // the painted bar: a quiet day's short bar is still easy to hit.
              <li
                key={point.key}
                tabIndex={0}
                data-tip-value={counted(point.value, singular)}
                data-tip-label={point.tip ?? point.label}
                aria-label={`${point.label}: ${counted(point.value, singular)}`}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-xs outline-offset-2"
              >
                {index === peakIndex ? (
                  <span className="text-ink-2 mb-0.5 text-xs font-medium tabular-nums">
                    {point.value}
                  </span>
                ) : null}
                <span
                  aria-hidden
                  className="bg-viz block w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                  style={{
                    height: `${(point.value / max) * 100}%`,
                    minHeight: point.value ? 2 : 0,
                  }}
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
              {labelled(index) ? point.label.replace(/^[A-Za-z]{3} /, "") : ""}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
