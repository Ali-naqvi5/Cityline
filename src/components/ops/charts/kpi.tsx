import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { formatPence, type Pence } from "@/domain/money";

import { cx } from "../primitives";

const pounds = (pence: number) => formatPence(pence as Pence);

/**
 * A headline figure with its change against the comparison period. The
 * colour says whether the change is good — more bookings is good, more
 * no-shows is not — and the arrow and words say which way it went, so it is
 * never colour alone.
 */
export function KpiTile({
  label,
  value,
  current,
  previous,
  better = "up",
  compareName,
  hint,
  tone,
  unit = "count",
}: {
  label: string;
  value: ReactNode;
  current: number;
  previous?: number | null;
  /** Which direction is good news; "none" for figures that are neither. */
  better?: "up" | "down" | "none";
  compareName?: string;
  hint?: ReactNode;
  tone?: "warn" | "danger";
  /**
   * What the figure counts. A percentage changes by points ("+5 pts"), and
   * minutes by minutes — never by a percentage of themselves.
   */
  unit?: "count" | "percent" | "minutes" | "pence";
}) {
  let delta: ReactNode = null;
  if (previous !== undefined && previous !== null && compareName) {
    const change = current - previous;
    const good =
      better === "none" || change === 0 ? null : change > 0 === (better === "up");
    const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
    const sign = change > 0 ? "+" : "";
    const amount =
      change === 0 && (previous === 0 || unit !== "count")
        ? "No change"
        : unit === "percent"
          ? `${sign}${change} pts`
          : unit === "minutes"
            ? `${sign}${change} min`
            : previous === 0
              ? `${sign}${unit === "pence" ? pounds(change) : change}`
              : `${sign}${Math.round((change / previous) * 100)}%`;
    const before =
      unit === "percent"
        ? `${previous}%`
        : unit === "minutes"
          ? `${previous} min`
          : unit === "pence"
            ? pounds(previous)
            : previous;
    delta = (
      <p
        className={cx(
          "mt-1 flex items-center gap-1 text-xs",
          good === null ? "text-ink-3" : good ? "text-ok" : "text-danger",
        )}
      >
        <Icon aria-hidden className="h-3.5 w-3.5" />
        <span>
          <span className="font-medium tabular-nums">{amount}</span>{" "}
          <span className="text-ink-3">
            vs {compareName} ({before})
          </span>
        </span>
      </p>
    );
  }

  return (
    <div className="border-line bg-surface rounded-xl border p-4 shadow-xs">
      <p className="text-ink-3 text-sm">{label}</p>
      <p
        className={cx(
          "mt-1.5 text-3xl font-semibold tracking-tight",
          tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </p>
      {delta}
      {hint ? <p className="text-ink-3 mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
