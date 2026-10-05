import { cx } from "../primitives";

import { HeatLegend, heatStep } from "./heatmap";
import { counted } from "./scale";

export interface DayGridRow {
  key: string | number;
  name: string;
  cells: readonly number[];
  total: number;
}

/**
 * People by day: one row per person, one cell per day (or week), darker for
 * more — the same single-hue shading as the busy-hours grid. The names stay
 * in view while the days scroll on a phone. Each cell's number is in its
 * read-out; each row's total sits at the end.
 */
export function DayGrid({
  columns,
  rows,
  singular = "booking",
}: {
  columns: readonly { key: string; label: string }[];
  rows: readonly DayGridRow[];
  singular?: string;
}) {
  const max = Math.max(0, ...rows.flatMap((row) => row.cells));
  // At most about ten column labels, so they never collide.
  const every = Math.max(1, Math.ceil(columns.length / 10));

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th scope="col" className="bg-surface sticky left-0 z-[1] min-w-32">
                <span className="sr-only">Driver</span>
              </th>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className="text-ink-3 min-w-5 px-0 text-center font-normal whitespace-nowrap tabular-nums"
                >
                  <span className="sr-only">{column.label}</span>
                  <span aria-hidden>
                    {index % every === 0 ? column.label.replace(/^[A-Za-z]{3} /, "") : ""}
                  </span>
                </th>
              ))}
              <th
                scope="col"
                className="text-ink-3 pl-2 text-right font-normal whitespace-nowrap"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th
                  scope="row"
                  className="bg-surface text-ink-2 sticky left-0 z-[1] max-w-40 truncate pr-2 text-left font-normal"
                >
                  {row.name}
                </th>
                {row.cells.map((value, index) => (
                  <td key={columns[index]?.key ?? index} className="p-0">
                    <span
                      tabIndex={value ? 0 : -1}
                      data-tip-value={counted(value, singular)}
                      data-tip-label={`${row.name} · ${columns[index]?.label ?? ""}`}
                      aria-label={`${row.name}, ${columns[index]?.label ?? ""}: ${counted(value, singular)}`}
                      className={cx(
                        "block h-6 min-w-5 rounded-[3px] outline-offset-1",
                        heatStep(value, max),
                      )}
                    />
                  </td>
                ))}
                <td className="text-ink pl-2 text-right font-medium tabular-nums">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HeatLegend />
    </div>
  );
}
