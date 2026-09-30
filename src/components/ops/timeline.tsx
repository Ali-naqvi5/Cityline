import type { ReactNode } from "react";

import { stamp } from "@/admin/format";

import { cx, type Tone } from "./primitives";

/**
 * A record's history, oldest first (spec §12): what happened, who did it,
 * when, and what changed.
 */

export interface TimelineEntry {
  id: string | number;
  title: ReactNode;
  actor: ReactNode;
  at: Date;
  detail?: ReactNode;
  tone?: Tone;
}

const DOT: Record<Tone, string> = {
  neutral: "bg-ink-4",
  info: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  special: "bg-special",
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative flex flex-col gap-4">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3">
          {index < entries.length - 1 ? (
            <span
              aria-hidden
              className="bg-line absolute top-4 bottom-[-16px] left-[5px] w-px"
            />
          ) : null}
          <span
            aria-hidden
            className={cx(
              "ring-surface relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2",
              DOT[entry.tone ?? "neutral"],
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-ink text-sm font-medium">{entry.title}</p>
            <p className="text-ink-3 text-xs">
              {entry.actor} ·{" "}
              <time dateTime={entry.at.toISOString()}>{stamp(entry.at)}</time>
            </p>
            {entry.detail ? (
              <div className="text-ink-2 mt-1 text-sm">{entry.detail}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** "old → new", for a changed field. */
export function Change({ from, to }: { from?: ReactNode; to?: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="bg-danger-soft text-danger decoration-danger/50 rounded-xs px-1 line-through">
        {from || "empty"}
      </span>
      <span aria-hidden className="text-ink-4">
        →
      </span>
      <span className="bg-ok-soft text-ok rounded-xs px-1">{to || "empty"}</span>
    </span>
  );
}
