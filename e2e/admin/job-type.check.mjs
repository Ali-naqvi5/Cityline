import "./local-only.mjs";
import { execFileSync } from "node:child_process";

import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const shots = "test-results/admin";
const PASSWORD = process.env.ADMIN_TEST_PASSWORD;
let failures = 0;
const check = (l, ok, d = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${l}${d ? `  — ${d}` : ""}`);
};
const sql = (q) =>
  execFileSync(
    "docker",
    [
      "exec",
      "cityline-local-db-1",
      "psql",
      "-U",
      "cityline",
      "-d",
      "cityline",
      "-t",
      "-A",
      "-c",
      q,
    ],
    { encoding: "utf8" },
  ).trim();
const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.request.post(`${base}/api/users/login`, {
  data: { email: "controller@local.test", password: PASSWORD },
});
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`${page.url().replace(base, "")}: ${String(e).slice(0, 160)}`),
);
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
  new Date(Date.now() + 5 * 86_400_000),
);

function cleanUp() {
  const ids = sql(
    "select string_agg(id::text, ',') from jobs where lead_name = 'Hourly Typecheck'",
  );
  if (ids) {
    sql(`delete from job_events where job_id in (${ids})`);
    sql(`delete from jobs where id in (${ids})`);
  }
  sql("delete from customers where name = 'Hourly Typecheck'");
}
cleanUp();

try {
  await page.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  check(
    "a new booking starts point to point: drop-off and stops, no hours",
    (await page.isChecked("#bookingType-transfer")) &&
      (await page.locator("#dropoffAddress").count()) === 1 &&
      (await page.locator("#hours").count()) === 0 &&
      (await page.getByRole("button", { name: "Add a stop" }).count()) === 1,
  );
  await page.click('label[for="bookingType-hourly"]');
  check(
    "hourly shows the hours instead, with no drop-off or stops",
    (await page.locator("#hours").count()) === 1 &&
      (await page.locator("#dropoffAddress").count()) === 0 &&
      (await page.getByRole("button", { name: "Add a stop" }).count()) === 0,
  );

  await page.selectOption("#source", "phone");
  await page.fill("#pickupDate", day);
  await page.fill("#pickupTime", "10:30");
  await page.fill("#pickupAddress", "The Savoy, Strand, London WC2R 0EZ");
  await page.click(`label[for="vehicleClassSlug-executive"]`);
  await page.fill("#passengers", "2");
  await page.fill("#leadName", "Hourly Typecheck");
  await page.fill("#leadPhone", "07700 900991");
  await page.fill("#price", "240");
  await page.selectOption("#paymentMethod", "card_link");
  await page.getByRole("button", { name: "Create booking" }).click();
  await page.getByText("Enter the hours, from 1 to 24.").waitFor({ timeout: 20_000 });
  check("an hourly booking needs its hours", true);
  await page.fill("#hours", "4");
  await page.getByRole("button", { name: "Create booking" }).click();
  await page
    .waitForURL(/notice=created|This may already/, { timeout: 30_000 })
    .catch(() => {});
  if (await page.getByRole("button", { name: /save anyway/ }).count()) {
    await page.getByRole("button", { name: /save anyway/ }).click();
    await page.waitForURL(/notice=created/, { timeout: 30_000 });
  }
  const id = Number(page.url().match(/jobs\/(\d+)/)?.[1]);
  check(
    "it is saved as hourly: hours, no drop-off",
    sql(
      `select hours || ':' || coalesce(dropoff_address, 'none') from jobs where id = ${id}`,
    ) === "4:none",
  );
  await page.goto(`${base}/admin/jobs/${id}/edit`, { waitUntil: "networkidle" });
  check("editing it opens as hourly", await page.isChecked("#bookingType-hourly"));

  // Switched to point to point, it needs a drop-off and loses its hours.
  await page.click('label[for="bookingType-transfer"]');
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Enter the drop-off address.").waitFor({ timeout: 20_000 });
  check("point to point needs a drop-off", true);
  await page.fill("#dropoffAddress", "Heathrow Terminal 5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/notice=saved/, { timeout: 30_000 });
  check(
    "saved point to point, the hours are dropped",
    sql(
      `select coalesce(hours::text, 'none') || ':' || dropoff_address from jobs where id = ${id}`,
    ) === "none:Heathrow Terminal 5",
  );
  await page.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${shots}/job-type.png`, fullPage: true });
} finally {
  cleanUp();
}
check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
