import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { cx } from "../primitives";

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
}) {
  let delta: ReactNode = null;
  if (previous !== undefined && previous !== null && compareName) {
    const change = current - previous;
    const good =
      better === "none" || change === 0 ? null : change > 0 === (better === "up");
    const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
    const amount =
      previous === 0
        ? change === 0
          ? "No change"
          : `${change > 0 ? "+" : ""}${change}`
        : `${change > 0 ? "+" : ""}${Math.round((change / previous) * 100)}%`;
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
            vs {compareName} ({previous})
          </span>
        </span>
      </p>
    );
  }

  return (
    <div className="border-line bg-surface rounded-lg border p-4 shadow-xs">
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
