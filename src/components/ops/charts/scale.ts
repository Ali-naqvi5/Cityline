/** A round top for an axis: 7 → 8, 23 → 25, 140 → 150. Never below 1. */
export function niceMax(value: number): number {
  if (value <= 1) return 1;
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

/** "42%" — whole percentages; "<1%" rather than a misleading 0. */
export function percent(share: number): string {
  if (share > 0 && share < 0.01) return "<1%";
  return `${Math.round(share * 100)}%`;
}

/** "1 booking", "3 bookings". */
export function counted(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
