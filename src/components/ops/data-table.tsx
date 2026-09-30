import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "./primitives";

/**
 * A table on desktop, cards on a phone (spec §46).
 *
 * Tables do not scroll sideways on small screens: below `md`, each row
 * becomes the card the screen supplies, showing the fields that matter in the
 * field; the full record is one tap away. On tablets, columns marked
 * `hideBelow: "xl"` or `"lg"` step out first.
 */

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** "wide" is 1400px: between xl and 2xl, where one more column fits. */
  hideBelow?: "lg" | "xl" | "wide" | "2xl";
  align?: "left" | "right";
  className?: string;
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  wide: "hidden min-[1400px]:table-cell",
  "2xl": "hidden 2xl:table-cell",
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  card,
  caption,
  rowClassName,
}: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  rowHref?: (row: T) => string;
  card: (row: T) => ReactNode;
  caption: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <>
      <ul className="divide-line divide-y md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const href = rowHref?.(row);
          return (
            <li key={rowKey(row)} className={rowClassName?.(row)}>
              {href ? (
                <Link href={href} className="active:bg-sunken block px-4 py-3">
                  {card(row)}
                </Link>
              ) : (
                <div className="px-4 py-3">{card(row)}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-line bg-sunken/60 border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    "text-ink-3 px-3 py-2 text-xs font-medium whitespace-nowrap first:pl-4 last:pr-4",
                    column.align === "right" ? "text-right" : "text-left",
                    column.hideBelow && HIDE[column.hideBelow],
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cx("hover:bg-sunken/50 align-top", rowClassName?.(row))}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      "px-3 py-2.5 first:pl-4 last:pr-4",
                      column.align === "right" && "text-right",
                      column.hideBelow && HIDE[column.hideBelow],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Pagination({
  page,
  totalPages,
  totalDocs,
  pageSize,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  totalDocs: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  if (totalDocs === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalDocs);
  const linkClass =
    "inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-ink-2 shadow-xs hover:bg-sunken lg:h-8";
  return (
    <nav
      aria-label="Pages"
      className="border-line text-ink-3 flex items-center justify-between gap-3 border-t px-4 py-3 text-sm"
    >
      <p className="tabular-nums">
        {first}–{last} of {totalDocs}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
