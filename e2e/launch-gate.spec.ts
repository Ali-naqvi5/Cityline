import { expect, test } from "@playwright/test";

/**
 * PRD-02. Until go-live the public sees the coming-soon page, search engines
 * see noindex, and owners get in with the preview token. Getting this wrong
 * means a half-built site gets indexed, which is expensive to undo.
 */
test.describe("launch gate", () => {
  test("the public sees the coming-soon page, marked noindex", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(
      page.getByRole("heading", { name: /booking site is on its way/i }),
    ).toBeVisible();
  });

  test("any site URL is gated, not just the home page", async ({ page }) => {
    await page.goto("/airports/heathrow");
    await expect(
      page.getByRole("heading", { name: /booking site is on its way/i }),
    ).toBeVisible();
  });

  test("the preview token lets an owner through and is dropped from the URL", async ({
    page,
  }) => {
    await page.goto("/?preview=e2e-preview-token");

    expect(page.url()).not.toContain("preview=");
    await expect(
      page.getByRole("heading", { level: 1, name: /london airport transfers/i }),
    ).toBeVisible();
  });

  test("a wrong token stays gated", async ({ page }) => {
    await page.goto("/?preview=not-the-token");
    await expect(
      page.getByRole("heading", { name: /booking site is on its way/i }),
    ).toBeVisible();
  });

  test("the health endpoint answers through the gate", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();

    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("database");
  });

  test("the cron endpoint refuses an unauthenticated call", async ({ request }) => {
    const response = await request.post("/api/cron");
    expect(response.status()).toBe(401);
  });
});
