/**
 * Counting helpers every report shares: breakdowns as shares of a whole, the
 * longest lists folded into "Other", free text tidied so the same reason
 * typed twice counts once, and the labels of a chart's day or week buckets.
 */

export interface Share {
  label: string;
  count: number;
  /** 0–1 of the breakdown's total. */
  share: number;
}

export function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Counts as shares, largest first — or in `order`, for buckets. */
export function shares(counts: Map<string, number>, order?: readonly string[]): Share[] {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const entries = [...counts.entries()];
  if (order) entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  else entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.map(([label, count]) => ({
    label,
    count,
    share: total ? count / total : 0,
  }));
}

/** The longest lists keep their top entries and fold the rest into "Other". */
export function topWithOther(list: Share[], keep: number): Share[] {
  if (list.length <= keep + 1) return list;
  const head = list.slice(0, keep);
  const tail = list.slice(keep);
  return [
    ...head,
    {
      label: "Other",
      count: tail.reduce((sum, item) => sum + item.count, 0),
      share: tail.reduce((sum, item) => sum + item.share, 0),
    },
  ];
}

/** A typed reason as a label: trimmed, capitalised, no full stop. */
export function reasonLabel(reason: string | null | undefined): string {
  const text = (reason ?? "").trim().replace(/\s+/g, " ").replace(/[.]+$/, "");
  if (!text) return "No reason given";
  return text[0]!.toUpperCase() + text.slice(1);
}

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const weekLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/** "Thu 1 Oct" for a day bucket, "w/c 28 Sept" for a week's. */
export function bucketLabel(key: string, unit: "day" | "week"): string {
  const date = new Date(`${key}T12:00:00Z`);
  return unit === "day"
    ? dayLabel.format(date).replace(",", "")
    : `w/c ${weekLabel.format(date)}`;
}

/** The middle value, or null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
