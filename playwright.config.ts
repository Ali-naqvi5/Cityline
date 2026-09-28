import { defineConfig, devices } from "@playwright/test";

/**
 * The booking funnel is the thing that must never break (NFR-07, PRD-06), so
 * e2e runs at both reference widths: 390px mobile and 1440px desktop (§6).
 *
 * NOT RUNNING YET. Browsers are not installed and the CI job is switched off
 * until the funnel exists in S3/S4 — there is nothing a real browser can tell
 * us about the current pages that a Vitest test cannot (see src/proxy.test.ts).
 * To turn it on:  pnpm exec playwright install --with-deps chromium
 *                 then re-enable the `e2e` job in .github/workflows/ci.yml
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
    timeout: 300_000,
    env: {
      LAUNCH_GATE: "on",
      PREVIEW_TOKEN: "e2e-preview-token",
      CRON_SECRET: "e2e-cron-secret",
      PAYLOAD_SECRET: "e2e-secret-e2e-secret-e2e-secret-abc",
      NEXT_PUBLIC_SITE_URL: baseURL,
      DATABASE_URL: "postgres://cityline:cityline@127.0.0.1:59999/cityline",
    },
  },
});
