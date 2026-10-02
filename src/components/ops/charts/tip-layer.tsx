"use client";

import { useRef, useState, type ReactNode } from "react";

import { cx } from "../primitives";

/**
 * Hover and focus read-outs for every chart inside it. A mark opts in with
 * `data-tip-value` (the number, shown strong) and `data-tip-label` (what it
 * is, shown quieter) and `tabIndex={0}` so the keyboard reaches it too.
 *
 * Tooltips add to the chart, they never replace it: every value is also in
 * the numbers beside or below it, so nothing is hover-only.
 */
export function TipLayer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    value: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);

  function show(target: EventTarget | null, clientX?: number, clientY?: number) {
    const mark = (target as Element | null)?.closest?.(
      "[data-tip-value]",
    ) as HTMLElement | null;
    const frame = box.current;
    if (!mark || !frame || !frame.contains(mark)) {
      setTip(null);
      return;
    }
    const outer = frame.getBoundingClientRect();
    const rect = mark.getBoundingClientRect();
    const x = (clientX ?? rect.left + rect.width / 2) - outer.left;
    const y = (clientY ?? rect.top) - outer.top;
    setTip({
      value: mark.dataset.tipValue ?? "",
      label: mark.dataset.tipLabel ?? "",
      // Keep the read-out inside the chart's frame.
      x: Math.min(Math.max(x, 72), Math.max(outer.width - 72, 72)),
      y,
    });
  }

  return (
    <div
      ref={box}
      className={cx("relative", className)}
      onPointerMove={(event) => show(event.target, event.clientX, event.clientY)}
      onPointerLeave={() => setTip(null)}
      onFocus={(event) => show(event.target)}
      onBlur={() => setTip(null)}
    >
      {children}
      {tip ? (
        <div
          role="tooltip"
          className="border-line bg-surface pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border px-2.5 py-1.5 whitespace-nowrap shadow-md"
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-ink text-sm font-semibold tabular-nums">{tip.value}</p>
          {tip.label ? <p className="text-ink-3 text-xs">{tip.label}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
