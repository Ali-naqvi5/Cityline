import { counted, percent } from "./scale";

export interface BarRow {
  label: string;
  count: number;
  share: number;
}

/**
 * A breakdown as horizontal bars: label, count and share on one line, the
 * bar beneath. One colour throughout — each category is named, so a colour
 * per row would only repeat what the label says.
 */
export function BarList({
  rows,
  singular = "booking",
  empty = "Nothing in this period.",
}: {
  rows: readonly BarRow[];
  singular?: string;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-ink-3 text-sm">{empty}</p>;
  const top = Math.max(...rows.map((row) => row.count), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li
          key={row.label}
          tabIndex={0}
          data-tip-value={counted(row.count, singular)}
          data-tip-label={`${row.label} · ${percent(row.share)} of the total`}
          className="rounded-xs outline-offset-2"
        >
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-2 min-w-0 truncate">{row.label}</span>
            <span className="text-ink shrink-0 tabular-nums">
              {row.count}
              <span className="text-ink-3 inline-block w-11 text-right text-xs">
                {percent(row.share)}
              </span>
            </span>
          </div>
          <div aria-hidden className="bg-sunken mt-1 h-2 rounded-r-[4px]">
            <div
              className="bg-viz h-2 rounded-r-[4px]"
              style={{ width: `${(row.count / top) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
