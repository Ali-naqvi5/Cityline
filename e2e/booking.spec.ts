import { expect, test } from "@playwright/test";

/**
 * The booking funnel, from the journey to the payment page (NFR-07, PRD-06):
 * the path that must never break.
 *
 * It stops at the card form, on purpose. Stripe's Payment Element has
 * protections against automated use, and Stripe's automated-testing guide
 * advises against driving it from CI. The e2e server runs without Stripe keys,
 * so step 4 shows its "not connected" panel instead. Taking the payment is
 * covered by the unit tests of the Checkout Session and fulfilment logic, and
 * by hand against the Stripe sandbox before a release (docs/progress.md).
 *
 * The site is behind the launch gate in e2e, as it is in production until
 * go-live, so these tests carry the owner's preview cookie.
 */

const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/** Two days ahead: always past the minimum notice, never past the booking horizon. */
const inTwoDays = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(Date.now() + 2 * 86_400_000),
  );

const journey = (overrides: Record<string, string> = {}) =>
  new URLSearchParams({
    pickup: "Hillingdon House, Wren Avenue, Uxbridge, UB10 0FD",
    dropoff: "Heathrow Airport",
    date: inTwoDays(),
    time: "10:30",
    passengers: "2",
    bags: "2",
    ...overrides,
  }).toString();

let violations: string[] = [];

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    { name: "cityline_preview", value: "e2e-preview-token", url: baseURL! },
  ]);

  // NFR-04: the booking pages run under a strict Content Security Policy, and
  // anything it blocks there is a broken page for a customer.
  violations = [];
  await context.exposeBinding("reportCsp", ({ frame }, message: string) => {
    if (frame === frame.page().mainFrame()) violations.push(message);
  });
  await context.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { reportCsp?: (message: string) => void }).reportCsp?.(
        `${event.violatedDirective} blocked ${event.blockedURI || "inline"} on ${location.pathname}`,
      );
    });
  });
});

test.afterEach(() => {
  expect(violations, "Content Security Policy violations").toEqual([]);
});

test("books from the journey to the payment page, at the fare it quoted", async ({
  page,
}) => {
  // Step 1 — as the quote widget hands it over.
  await page.goto(`/book?${journey()}`);
  await page.getByRole("button", { name: "See prices" }).click();

  // Step 2 — choose the saloon and note its price.
  await expect(page).toHaveURL(/\/book\/vehicle\?/);
  await page
    .locator("label", { has: page.getByRole("heading", { name: "Saloon", exact: true }) })
    .click();
  const selected = page.getByText(/^Saloon selected — £[\d,]+\.\d{2}$/);
  await expect(selected).toBeVisible();
  const fare = /£[\d,]+\.\d{2}/.exec((await selected.textContent()) ?? "")?.[0];
  expect(fare).toBeTruthy();

  await page.getByRole("link", { name: /continue to passenger details/i }).click();

  // Step 3 — the passenger.
  await expect(page).toHaveURL(/\/book\/details\?.*vehicle=saloon/);
  await page.fill('[name="firstName"]', "Test");
  await page.fill('[name="lastName"]', "Passenger");
  await page.fill('[name="email"]', "e2e@example.com");
  await page.fill('[name="phone"]', "07700 900123");
  await page.check('[name="acceptedTerms"]');
  await page.getByRole("button", { name: /continue to payment/i }).click();

  // Step 4 — the price is the server's quote, not the URL's.
  await expect(page).toHaveURL(/\/book\/payment\?q=[\w-]+$/);
  await expect(page.getByRole("heading", { name: "Review and pay" })).toBeVisible();
  await expect(page.getByText("Total to pay").locator("..")).toContainText(fare!);
  await expect(page.getByText("Heathrow Airport").first()).toBeVisible();
  await expect(page.getByText(/card payment is not connected yet/i)).toBeVisible();

  // No personal details travel in the URL (BK-08).
  expect(page.url()).not.toContain("example.com");
  expect(page.url()).not.toContain("07700");
});

test("refuses a pickup inside the minimum notice, and says why", async ({ page }) => {
  await page.goto(`/book/vehicle?${journey({ date: londonToday(), time: "00:00" })}`);

  await expect(
    page.getByText(/Online bookings need at least \d+ hours?'s? notice/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /continue to passenger details/i }),
  ).toHaveCount(0);
});

test("sends an unknown quote back to the start", async ({ page }) => {
  await page.goto("/book/payment?q=not-a-real-quote");
  await expect(page).toHaveURL(/\/book$/);
});
