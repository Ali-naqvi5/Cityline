import { defineConfig, devices } from "@playwright/test";

/**
 * The booking funnel is the thing that must never break (NFR-07, PRD-06), so
 * e2e runs at both reference widths: 390px mobile and 1440px desktop (§6).
 *
 * Needs Postgres, migrated: locally `pnpm db:up && pnpm migrate`; in CI the
 * `e2e` job starts a Postgres service. Then `pnpm e2e`. Chrome for Playwright:
 * `pnpm exec playwright install chromium`.
 *
 * The server runs with Stripe and email switched off — empty values, which
 * Next does not replace from `.env.local` — so a test run never creates a
 * Checkout Session or sends a message, and behaves the same on every machine.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm exec next start --port ${PORT}`,
    // Readiness is the gated home page: /api/health answers 503 without a
    // database, which Playwright would never accept as "up".
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    env: {
      LAUNCH_GATE: "on",
      PREVIEW_TOKEN: "e2e-preview-token",
      CRON_SECRET: "e2e-cron-secret",
      PAYLOAD_SECRET: "e2e-secret-e2e-secret-e2e-secret-abc",
      NEXT_PUBLIC_SITE_URL: baseURL,
      // compose.local.yaml locally, the Postgres service in CI.
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        "postgres://cityline:cityline@127.0.0.1:5432/cityline",
      STRIPE_SECRET_KEY: "",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      NUNTLY_API_KEY: "",
    },
  },
});
