import { cx } from "../primitives";

import { counted } from "./scale";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const STEPS = ["bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4", "bg-heat-5"];

const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

/**
 * When pickups happen: weekday by hour, darker is busier — one hue, so it
 * reads as "more", never as categories. Empty hours are the plain surface.
 * Each cell's number is in its read-out and in the table beneath.
 */
export function Heatmap({
  grid,
  singular = "pickup",
}: {
  grid: number[][];
  singular?: string;
}) {
  const max = Math.max(0, ...grid.flat());
  const step = (value: number) =>
    value === 0
      ? "bg-sunken"
      : STEPS[Math.min(STEPS.length - 1, Math.ceil((value / max) * STEPS.length) - 1)]!;

  return (
    <div>
      <div className="relative overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[2px]">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              aria-hidden
              className="text-ink-3 text-center text-[10px] tabular-nums"
            >
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </span>
          ))}
          {grid.map((row, day) => (
            <div key={DAYS[day]} className="contents">
              <span className="text-ink-3 self-center text-xs">{DAYS[day]}</span>
              {row.map((value, h) => (
                <span
                  key={h}
                  tabIndex={value ? 0 : -1}
                  data-tip-value={counted(value, singular)}
                  data-tip-label={`${FULL_DAYS[day]}, ${hour(h)}–${hour((h + 1) % 24)}`}
                  aria-label={`${FULL_DAYS[day]} ${hour(h)}: ${counted(value, singular)}`}
                  className={cx("block h-6 rounded-[3px] outline-offset-1", step(value))}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="text-ink-3 mt-2 flex items-center justify-end gap-1.5 text-xs">
        <span>Fewer</span>
        {["bg-sunken", ...STEPS].map((swatch) => (
          <span
            key={swatch}
            aria-hidden
            className={cx("h-3 w-4 rounded-[3px]", swatch)}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
