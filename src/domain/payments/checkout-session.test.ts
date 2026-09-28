import { describe, expect, it } from "vitest";

import type { QuoteResults } from "@/domain/booking/quote-session";

import {
  checkoutIdempotencyKey,
  checkoutSessionParams,
  fulfilmentStateOf,
  INTEGRATION_IDENTIFIER,
  lineItemsFor,
  type QuoteForCheckout,
} from "./checkout-session";

const RETURN_TRIP: QuoteResults = {
  vehicleSlug: "executive",
  legs: 2,
  lines: [
    { label: "Executive saloon, both journeys", detail: "2 × £68", amountPence: 13600 },
    { label: "Child seat (15 months – 4 years)", amountPence: 1000 },
  ],
  totalPence: 14600,
};

const QUOTE: QuoteForCheckout = {
  id: 42,
  expiresAt: new Date("2026-12-01T10:30:00Z"),
  customerEmail: "aisha.rahman@example.com",
  results: RETURN_TRIP,
};

const sumOf = (items: ReturnType<typeof lineItemsFor>) =>
  items.reduce(
    (total, item) => total + (item.price_data?.unit_amount ?? 0) * (item.quantity ?? 0),
    0,
  );

describe("lineItemsFor", () => {
  it("itemises the quote the way step 4 shows it", () => {
    const items = lineItemsFor(RETURN_TRIP);

    expect(items).toHaveLength(2);
    expect(items[0]?.price_data?.product_data?.name).toBe(
      "Executive saloon, both journeys",
    );
    expect(items[0]?.price_data?.product_data?.description).toBe("2 × £68");
  });

  it("charges exactly the quoted total, in pence and pounds sterling", () => {
    const items = lineItemsFor(RETURN_TRIP);

    expect(sumOf(items)).toBe(14600);
    expect(items.every((item) => item.price_data?.currency === "gbp")).toBe(true);
  });

  it("omits an empty description, which Stripe would reject", () => {
    const seat = lineItemsFor(RETURN_TRIP)[1];
    expect(seat?.price_data?.product_data).not.toHaveProperty("description");
  });

  it("falls back to one line for the total if the lines do not add up", () => {
    // Charging the quoted total matters more than itemising it.
    const items = lineItemsFor({ ...RETURN_TRIP, totalPence: 15000 });

    expect(items).toHaveLength(1);
    expect(sumOf(items)).toBe(15000);
  });

  it("falls back to one line if any line is not a positive whole amount", () => {
    const withDiscount = lineItemsFor({
      ...RETURN_TRIP,
      lines: [...RETURN_TRIP.lines, { label: "Discount", amountPence: -500 }],
      totalPence: 14100,
    });

    expect(withDiscount).toHaveLength(1);
    expect(sumOf(withDiscount)).toBe(14100);
  });
});

describe("checkoutSessionParams", () => {
  const params = checkoutSessionParams(QUOTE, "https://citylineairporttransfers.com");

  it("embeds the Payment Element through Checkout Sessions", () => {
    expect(params.ui_mode).toBe("elements");
    expect(params.mode).toBe("payment");
  });

  it("never lists payment method types, so Stripe's dynamic methods apply", () => {
    // Hard-coding ['card'] would hide Apple Pay and Google Pay.
    expect(params).not.toHaveProperty("payment_method_types");
  });

  it("books under the email the customer gave at step 3", () => {
    expect(params.customer_email).toBe("aisha.rahman@example.com");
  });

  it("carries the quote id so fulfilment can find the quote again", () => {
    expect(params.client_reference_id).toBe("42");
    expect(params.metadata).toEqual({ quote_id: "42" });
    expect(params.payment_intent_data?.metadata).toEqual({ quote_id: "42" });
  });

  it("returns to the page that confirms the booking, with Stripe's placeholder", () => {
    expect(params.return_url).toBe(
      "https://citylineairporttransfers.com/book/return?session_id={CHECKOUT_SESSION_ID}",
    );
  });

  it("expires 35 minutes after the quote, from the quote rather than the clock", () => {
    // Deterministic, so every page load sends Stripe identical parameters and
    // the idempotency key returns the same session.
    expect(params.expires_at).toBe(Date.parse("2026-12-01T11:05:00Z") / 1000);
    expect(checkoutSessionParams(QUOTE, "https://citylineairporttransfers.com")).toEqual(
      params,
    );
  });

  it("tags the session with an integration identifier ending in eight letters", () => {
    expect(params.integration_identifier).toBe(INTEGRATION_IDENTIFIER);
    expect(INTEGRATION_IDENTIFIER).toMatch(/_[a-z]{8}$/);
  });
});

describe("checkoutIdempotencyKey", () => {
  it("is one key per quote", () => {
    expect(checkoutIdempotencyKey(42)).toBe(checkoutIdempotencyKey(42));
    expect(checkoutIdempotencyKey(42)).not.toBe(checkoutIdempotencyKey(43));
  });
});

describe("fulfilmentStateOf", () => {
  it("fulfils a paid session", () => {
    expect(fulfilmentStateOf({ status: "complete", payment_status: "paid" })).toBe(
      "fulfil",
    );
  });

  it("waits on a completed session whose delayed payment has not settled", () => {
    // Booking a car here would be booking it for money that may never arrive.
    expect(fulfilmentStateOf({ status: "complete", payment_status: "unpaid" })).toBe(
      "processing",
    );
  });

  it("sends an open, unpaid session back to pay", () => {
    expect(fulfilmentStateOf({ status: "open", payment_status: "unpaid" })).toBe(
      "unpaid",
    );
  });

  it("treats a lapsed session as expired", () => {
    expect(fulfilmentStateOf({ status: "expired", payment_status: "unpaid" })).toBe(
      "expired",
    );
  });
});
