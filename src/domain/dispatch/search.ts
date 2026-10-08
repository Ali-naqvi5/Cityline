/**
 * The search that finds a driver or a car as the office remembers them — a
 * name, part of a registration, a make or model (Cityline, 9 Oct 2026). One
 * box for all of it: every word typed must match something, and the closest
 * matches come first. Spaces inside a registration do not matter, and a
 * slip of the finger still finds the driver ("tylor" finds Taylor).
 */

const compact = (value: string) => value.toLowerCase().replace(/[\s-]+/g, "");

/** Whether every letter of `needle` appears in `haystack`, in order. */
function inOrder(needle: string, haystack: string): boolean {
  let at = 0;
  for (const letter of haystack) {
    if (letter === needle[at]) at += 1;
    if (at === needle.length) return true;
  }
  return false;
}

function termScore(term: string, fields: readonly string[]): number {
  const wanted = compact(term);
  if (!wanted) return 0;
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    const whole = compact(field);
    const words = field
      .toLowerCase()
      .split(/[\s-]+/)
      .filter(Boolean);
    if (whole === wanted) best = Math.max(best, 100);
    else if (whole.startsWith(wanted) || words.some((word) => word.startsWith(wanted)))
      best = Math.max(best, 70);
    else if (whole.includes(wanted)) best = Math.max(best, 45);
    else if (wanted.length >= 3 && inOrder(wanted, whole)) best = Math.max(best, 15);
  }
  return best;
}

/**
 * How well a query matches a thing described by `fields`: 0 for no match,
 * higher for closer. An empty query matches everything equally.
 */
export function matchScore(query: string, fields: readonly string[]): number {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  // A whole registration or name typed exactly, spaces or not, comes first.
  const whole = compact(query);
  if (fields.some((field) => field && compact(field) === whole)) return 1000;
  let total = 0;
  for (const term of terms) {
    const score = termScore(term, fields);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

/** The items matching a query, closest first; ties keep their order. */
export function rankMatches<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => readonly string[],
): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((item, index) => ({ item, index, score: matchScore(query, fields(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
