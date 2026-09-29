"use client";

import { useSyncExternalStore } from "react";

import { earliestBookableDate } from "@/domain/booking/booking-dates";

/**
 * The earliest bookable date, worked out in the visitor's browser (BK-05).
 *
 * Most pages that carry the quote widget — the home page, the airport and
 * service guides — are built once, at deploy time, and served as static HTML.
 * A date computed on the server for them is frozen on deploy day, so a week
 * later the picker would happily offer days that have already gone. Working it
 * out here keeps it right however old the page is.
 *
 * `useSyncExternalStore` rather than state set in an effect: the server
 * snapshot (`undefined`, no limit yet) is used while hydrating, so the markup
 * matches, and the clock's value takes over straight after. The one-minute
 * subscription moves the limit on at midnight for anyone who leaves the page
 * open.
 */
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

export function useEarliestBookableDate(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => earliestBookableDate(),
    () => undefined,
  );
}
