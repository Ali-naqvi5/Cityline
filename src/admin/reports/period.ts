import {
  addDays,
  isValidDay,
  londonDay,
  londonDayBounds,
  mondayOf,
} from "@/admin/format";

/**
 * The period a report covers, in London days, and the period it is compared
 * with. Every report reads its period through here, so "this month" means
 * the same thing on each of them, and so does the comparison beside each
 * figure.
 *
 * The comparison is the like-for-like period before: this month so far
 * against the same days of last month, this week so far against the same days
 * of last week, a whole month against the month before, and any other span
 * against the same number of days just before it.
 */

export const PERIOD_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_week: "Last week",
  this_month: "This month",
  last_month: "Last month",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  custom: "Chosen dates",
} as const;

export type PeriodKey = keyof typeof PERIOD_LABELS;

export interface DayRange {
  /** YYYY-MM-DD, London, inclusive. */
  from: string;
  to: string;
  /** UTC instants: start inclusive, end exclusive. */
  start: Date;
  end: Date;
  label: string;
}

export interface Period extends DayRange {
  key: PeriodKey;
  days: number;
  previous: DayRange & { name: string };
}

/** The longest span a report covers at once. */
export const MAX_DAYS = 366;

const shortFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const longFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** "2 Oct 2026", "1–31 Oct 2026", "28 Sep – 4 Oct 2026", "29 Dec 2026 – 4 Jan 2027" */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return longFormat.format(asDate(from));
  const [fy, fm] = from.split("-");
  const [ty, tm] = to.split("-");
  if (fy === ty && fm === tm) {
    return `${Number(from.slice(8))}–${longFormat.format(asDate(to))}`;
  }
  if (fy === ty)
    return `${shortFormat.format(asDate(from))} – ${longFormat.format(asDate(to))}`;
  return `${longFormat.format(asDate(from))} – ${longFormat.format(asDate(to))}`;
}

function range(from: string, to: string): DayRange {
  return {
    from,
    to,
    start: londonDayBounds(from).start,
    end: londonDayBounds(to).end,
    label: rangeLabel(from, to),
  };
}

export function daysBetween(from: string, to: string): number {
  return Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000) + 1;
}

const firstOfMonth = (day: string) => `${day.slice(0, 8)}01`;
function lastOfMonth(day: string): string {
  const [y, m] = day.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function previousMonth(day: string): string {
  const [y, m] = day.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

type Params = Record<string, string | string[] | undefined> | undefined;
const read = (params: Params, key: string) => {
  const value = params?.[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
};

export function resolvePeriod(
  params: Params,
  now: Date = new Date(),
  fallback: PeriodKey = "this_month",
): Period {
  const today = londonDay(now);
  const fromParam = read(params, "from");
  const toParam = read(params, "to");
  const keyParam = read(params, "period") as PeriodKey;
  let key: PeriodKey =
    isValidDay(fromParam) && isValidDay(toParam)
      ? "custom"
      : keyParam in PERIOD_LABELS && keyParam !== "custom"
        ? keyParam
        : fallback;

  let from = today;
  let to = today;
  let previous: { from: string; to: string; name: string };

  switch (key) {
    case "yesterday":
      from = to = addDays(today, -1);
      previous = {
        from: addDays(today, -2),
        to: addDays(today, -2),
        name: "the day before",
      };
      break;
    case "this_week": {
      from = mondayOf(today);
      const length = daysBetween(from, today);
      previous = {
        from: addDays(from, -7),
        to: addDays(from, length - 8),
        name: "the same days last week",
      };
      break;
    }
    case "last_week":
      from = addDays(mondayOf(today), -7);
      to = addDays(from, 6);
      previous = {
        from: addDays(from, -7),
        to: addDays(from, -1),
        name: "the week before",
      };
      break;
    case "this_month": {
      from = firstOfMonth(today);
      const start = previousMonth(today);
      const dayOfMonth = Number(today.slice(8));
      const end = `${start.slice(0, 8)}${String(
        Math.min(dayOfMonth, Number(lastOfMonth(start).slice(8))),
      ).padStart(2, "0")}`;
      previous = { from: start, to: end, name: "the same days last month" };
      break;
    }
    case "last_month": {
      from = previousMonth(today);
      to = lastOfMonth(from);
      const before = previousMonth(from);
      previous = { from: before, to: lastOfMonth(before), name: "the month before" };
      break;
    }
    case "last_30":
    case "last_90": {
      const length = key === "last_30" ? 30 : 90;
      from = addDays(today, -(length - 1));
      previous = {
        from: addDays(from, -length),
        to: addDays(from, -1),
        name: `the ${length} days before`,
      };
      break;
    }
    case "custom": {
      [from, to] = fromParam <= toParam ? [fromParam, toParam] : [toParam, fromParam];
      if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
      const length = daysBetween(from, to);
      previous = {
        from: addDays(from, -length),
        to: addDays(from, -1),
        name: length === 1 ? "the day before" : `the ${length} days before`,
      };
      break;
    }
    case "today":
    default:
      key = "today";
      previous = { from: addDays(today, -1), to: addDays(today, -1), name: "yesterday" };
  }

  return {
    key,
    ...range(from, to),
    days: daysBetween(from, to),
    previous: { ...range(previous.from, previous.to), name: previous.name },
  };
}

/**
 * The buckets a period's chart counts by: days up to two months, then weeks
 * starting on Monday — 90 daily columns are too thin to read.
 */
export function buckets(period: Pick<Period, "from" | "to" | "days">): {
  unit: "day" | "week";
  keys: string[];
} {
  if (period.days <= 62) {
    return {
      unit: "day",
      keys: Array.from({ length: period.days }, (_, index) =>
        addDays(period.from, index),
      ),
    };
  }
  const keys: string[] = [];
  for (
    let monday = mondayOf(period.from);
    monday <= period.to;
    monday = addDays(monday, 7)
  ) {
    keys.push(monday);
  }
  return { unit: "week", keys };
}

/** The bucket a London day falls in. */
export function bucketOf(day: string, unit: "day" | "week"): string {
  return unit === "day" ? day : mondayOf(day);
}
