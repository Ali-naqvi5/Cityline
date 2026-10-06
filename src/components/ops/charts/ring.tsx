import type { ReactNode } from "react";

import { cx } from "../primitives";

import { percent } from "./scale";

const SIZE = 96;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A ratio as a ring — a meter bent round: the filled arc in the one series
 * colour, the track a lighter step of the same blue, the share written in the
 * middle and the figures beside it in plain text, so the ring never carries
 * the number alone. Hover or focus it for the read-out. A share that cannot
 * be worked out (nothing to measure against) leaves the track empty and says
 * so.
 */
export function Ring({
  label,
  value,
  share,
  caption,
  tip,
  tone,
}: {
  label: string;
  value: ReactNode;
  /** 0–1, or null when there is nothing to measure against. */
  share: number | null;
  caption: ReactNode;
  /** The hover read-out's second line. */
  tip: string;
  tone?: "danger";
}) {
  const filled = share === null ? 0 : Math.min(1, Math.max(0, share));
  const shown = share === null ? "—" : percent(Math.max(0, share));
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div
        tabIndex={0}
        data-tip-value={`${shown} · ${label}`}
        data-tip-label={tip}
        className="relative shrink-0 rounded-full outline-offset-2"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`${label}: ${shown}. ${tip}`}
          className="-rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-accent-line"
          />
          {filled > 0 ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap={filled < 1 ? "round" : "butt"}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
              className="stroke-viz"
            />
          ) : null}
        </svg>
        <span
          aria-hidden
          className="text-ink absolute inset-0 flex items-center justify-center text-base font-semibold"
        >
          {shown}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-ink-3 text-sm">{label}</p>
        <p
          className={cx(
            "mt-0.5 text-2xl font-semibold tracking-tight",
            tone === "danger" ? "text-danger" : "text-ink",
          )}
        >
          {value}
        </p>
        <p className="text-ink-3 mt-0.5 text-xs">{caption}</p>
      </div>
    </div>
  );
}
