import "./local-only.mjs";
// Read-only: views pages only, creates and changes nothing (sign-ins aside).
import { execFileSync } from "node:child_process";

import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
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
async function session(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.request.post(`${base}/api/users/login`, {
    data: { email, password: PASSWORD },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push(`${email} ${page.url().replace(base, "")}: ${String(e).slice(0, 160)}`),
  );
  return { context, page };
}
const flat = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ");
const londonDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(Date.now() + offset * 86_400_000),
  );

const jobId = Number(sql("select id from jobs order by id desc limit 1"));

// --- The built-in record screens: the Owner's alone ------------------------------
{
  const { page, context } = await session("controller@local.test");
  const list = await page.goto(`${base}/admin/collections/jobs`, {
    waitUntil: "networkidle",
  });
  const doc = await page.goto(`${base}/admin/collections/jobs/${jobId}`, {
    waitUntil: "networkidle",
  });
  const docBody = await flat(page);
  check(
    "a Controller gets 'not found' for the built-in list and record",
    list.status() === 404 && doc.status() === 404 && !docBody.includes("Save"),
    `list ${list.status()}, record ${doc.status()}`,
  );
  const account = await page.goto(`${base}/admin/account`, { waitUntil: "networkidle" });
  check(
    "…but still has their own Account page",
    account.status() === 200 &&
      (await page.locator('input[name="email"], #field-email').count()) > 0,
    `status ${account.status()}`,
  );
  const api = await page.evaluate(
    async (id) => (await fetch(`/api/jobs/${id}?depth=0`)).status,
    jobId,
  );
  check("…and the operations data they use is unchanged", api === 200, `api ${api}`);
  await context.close();
}
{
  const { page, context } = await session("accounts@local.test");
  const res = await page.goto(`${base}/admin/collections/payments`, {
    waitUntil: "networkidle",
  });
  check("Accounts gets 'not found' too", res.status() === 404, `status ${res.status()}`);
  await context.close();
}
{
  const { page, context } = await session("owner@local.test");
  const res = await page.goto(`${base}/admin/collections/jobs/${jobId}`, {
    waitUntil: "networkidle",
  });
  check(
    "the Owner still opens the raw record",
    res.status() === 200 && (await flat(page)).includes("Save"),
    `status ${res.status()}`,
  );
  await context.close();
}

// --- Filter bars follow the address -------------------------------------------------
{
  const { page, context } = await session("controller@local.test");
  const today = londonDay();
  await page.goto(`${base}/admin/reports/run-sheet?date=${today}`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("link", { name: "The day after" }).click();
  await page.waitForURL(new RegExp(`date=${londonDay(1)}`), { timeout: 30_000 });
  await page
    .waitForFunction(
      (day) => document.querySelector("#run-sheet-date")?.value === day,
      londonDay(1),
      { timeout: 10_000 },
    )
    .catch(() => {});
  check(
    "the Run Sheet's arrow moves the date box with it",
    (await page.inputValue("#run-sheet-date")) === londonDay(1),
    await page.inputValue("#run-sheet-date"),
  );
  await page.getByRole("link", { name: "The day before" }).click();
  await page.waitForURL((url) => !url.search.includes(`date=${londonDay(1)}`), {
    timeout: 30_000,
  });
  await page
    .waitForFunction(
      (day) => document.querySelector("#run-sheet-date")?.value === day,
      today,
      { timeout: 10_000 },
    )
    .catch(() => {});
  check("…both ways", (await page.inputValue("#run-sheet-date")) === today);

  await page.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
  await page.locator("a", { hasText: "Need a driver (24 h)" }).first().click();
  await page.waitForURL(/status=unassigned/, { timeout: 30_000 });
  await page
    .waitForFunction(
      () => document.querySelector("#bookings-status")?.value === "unassigned",
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});
  check(
    "a Bookings card sets the status filter it opens with",
    (await page.inputValue("#bookings-status")) === "unassigned",
    await page.inputValue("#bookings-status"),
  );

  await page.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
  await page.click("#bookings-q");
  await page.keyboard.type("J-00");
  await page.waitForURL(/q=J-00/, { timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.keyboard.type("0");
  const typed = await page.inputValue("#bookings-q");
  const focused = await page.evaluate(() => document.activeElement?.id);
  check(
    "typing in the search box is never interrupted",
    typed === "J-000" && focused === "bookings-q",
    `${typed} / ${focused}`,
  );
  await context.close();
}

// --- Car classes ------------------------------------------------------------------------
const WANT = [
  "Saloon",
  "Green Class",
  "Executive Saloon",
  "Estate",
  "People Carrier",
  "Large People Carrier",
];
{
  const { page, context } = await session("controller@local.test");
  await page.goto(`${base}/admin/vehicles/new`, { waitUntil: "networkidle" });
  const carOptions = (await page.locator("#vehicleClassSlug option").allInnerTexts())
    .map((t) => t.trim())
    .filter((t) => t && !/^choose/i.test(t));
  check(
    "adding a car offers the six classes, in order",
    JSON.stringify(carOptions) === JSON.stringify(WANT),
    carOptions.join(" | "),
  );
  await page.goto(`${base}/admin/drivers/new`, { waitUntil: "networkidle" });
  const driverOptions = (await page.locator("#vehicleClassSlug option").allInnerTexts())
    .map((t) => t.trim())
    .filter((t) => t && !/^choose/i.test(t));
  check(
    "adding a driver with their car offers the same six",
    JSON.stringify(driverOptions) === JSON.stringify(WANT),
    driverOptions.join(" | "),
  );
  await page.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  const jobBody = await flat(page);
  check(
    "a new booking offers the six, and no minibus",
    WANT.every((name) => jobBody.includes(name)) &&
      !/16 seat minibus|MPV 5|MPV 8/.test(jobBody),
  );
  await page.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
  const filterOptions = (await page.locator("#bookings-vehicle option").allInnerTexts())
    .map((t) => t.trim())
    .filter((t) => !/^any/i.test(t));
  check(
    "the Bookings car filter lists the six",
    JSON.stringify(filterOptions) === JSON.stringify(WANT),
    filterOptions.join(" | "),
  );
  await context.close();
}
{
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push(`public ${page.url().replace(base, "")}: ${String(e).slice(0, 160)}`),
  );
  const res = await page.goto(`${base}/fleet`, { waitUntil: "load", timeout: 120_000 });
  const body = await flat(page);
  if (/coming soon/i.test(body) && !/Green Class/.test(body)) {
    check(
      "website fleet page (behind the launch gate locally)",
      true,
      "gate on — not checked",
    );
  } else {
    check(
      "the website's fleet page shows the same six",
      res.status() === 200 &&
        WANT.every((name) => body.includes(name)) &&
        !body.includes("16 seat minibus"),
    );
  }
  await context.close();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
