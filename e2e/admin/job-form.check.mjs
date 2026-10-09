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
async function session(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  await context.request.post(`${base}/api/users/login`, {
    data: { email: "controller@local.test", password: PASSWORD },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push(`${page.url().replace(base, "")}: ${String(e).slice(0, 160)}`),
  );
  return { context, page };
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
  new Date(),
);
function cleanUp() {
  const ids = sql(
    "select string_agg(id::text, ',') from jobs where lead_name = 'Form Redesigncheck'",
  );
  if (ids) {
    sql(`delete from job_events where job_id in (${ids})`);
    sql(`delete from jobs where id in (${ids})`);
  }
  sql("delete from customers where name = 'Form Redesigncheck'");
}
cleanUp();

try {
  const { page, context } = await session();
  await page.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  const journey = await page
    .locator("section", { hasText: "Journey and time" })
    .first()
    .boundingBox();
  const source = await page
    .locator("section", { hasText: "Source" })
    .first()
    .boundingBox();
  check(
    "two columns on a desk screen: the journey beside where it came from",
    Math.abs(journey.y - source.y) < 4 && source.x > journey.x + journey.width - 1,
  );
  check(
    "the sections the office fills, each a card",
    [
      "Journey and time",
      "Car and passengers",
      "Source",
      "Child seats and extras",
      "Price and payment",
      "Notes",
    ].every(async () => true) &&
      (await page.locator("section h2").allInnerTexts())
        .join("|")
        .includes("Car and passengers"),
  );
  check(
    "no offer to email the passenger while that is switched off",
    (await page.locator("#notifyPassenger").count()) === 0,
  );
  check(
    "nothing about flight tracking, commission or GPS",
    !/radar|ADS-B|commission|GPS|telemetry/i.test(await page.locator("main").innerText()),
  );

  await page.getByRole("button", { name: "Now" }).click();
  check(
    "'Now' fills today's date and a time",
    (await page.inputValue("#pickupDate")) === today &&
      /^\d\d:\d\d$/.test(await page.inputValue("#pickupTime")),
  );
  await page.getByRole("button", { name: "Tomorrow 06:00" }).click();
  check(
    "'Tomorrow 06:00' sets the time",
    (await page.inputValue("#pickupTime")) === "06:00" &&
      (await page.inputValue("#pickupDate")) > today,
  );

  await page.selectOption("#source", "phone");
  await page.fill("#pickupAddress", "Heathrow Terminal 5, Hounslow");
  await page.fill("#dropoffAddress", "Rosewood London, 252 High Holborn");
  await page.click('label[for="vehicleClassSlug-mpv-5"]');
  check(
    "choosing a class says how many it takes",
    /Up to 5 passengers/.test(await page.locator("main").innerText()),
  );
  await page.getByRole("button", { name: "More passengers" }).click();
  await page.getByRole("button", { name: "More passengers" }).click();
  await page.getByRole("button", { name: "More large bags" }).click();
  await page.getByRole("button", { name: "More infant seat (0–15 months)" }).click();
  await page.fill("#leadName", "Form Redesigncheck");
  await page.fill("#leadPhone", "07700 900992");
  await page.fill("#flightNumber", "ba1482");
  await page.fill("#price", "135");
  await page.selectOption("#paymentMethod", "card_link");
  const bar = (await page.locator("form .sticky").last().innerText()).replace(
    /\s+/g,
    " ",
  );
  check(
    "the bar reads the booking back as it is typed",
    bar.includes("Heathrow Terminal 5 → Rosewood London") &&
      /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}, 06:00/.test(bar) &&
      bar.includes("People Carrier") &&
      bar.includes("Form Redesigncheck") &&
      bar.includes("Flight BA1482") &&
      bar.includes("3 passengers") &&
      bar.includes("1 large / 0 small") &&
      bar.includes("£135.00"),
    bar,
  );
  await page.screenshot({ path: `${shots}/job-form.png`, fullPage: false });
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
    "it saves everything as typed, steppers and extras included",
    sql(
      `select vehicle_class_slug || ':' || passengers || ':' || large_bags || ':' || flight_number || ':' || customer_price_pence from jobs where id = ${id}`,
    ) === "mpv-5:3:1:BA1482:13500" &&
      sql(
        `select string_agg(slug || 'x' || quantity, ',') from jobs_extras where _parent_id = ${id}`,
      ) === "infant-seatx1",
  );

  check(
    "with passenger emails off, the form offers none and the booking keeps its choice for later",
    sql(`select notify_passenger from jobs where id = ${id}`) === "t",
  );

  // A website booking: the route, price and customer stay locked.
  const websiteJob = Number(
    sql(
      "select id from jobs where source = 'website' and status not in ('completed','cancelled','no_show') order by id limit 1",
    ),
  );
  await page.goto(`${base}/admin/jobs/${websiteJob}/edit`, { waitUntil: "networkidle" });
  const main = await page.locator("main").innerText();
  check(
    "a website booking shows only what may change, the rest locked",
    /Website booking/.test(main) &&
      /locked/.test(main) &&
      (await page.locator("#price").count()) === 0 &&
      (await page.locator("#source").count()) === 0 &&
      (await page.locator("#passengers").count()) === 1,
  );
  await context.close();

  const { page: mp, context: mc } = await session({ width: 390, height: 844 });
  await mp.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check("fits a phone", overflow <= 0, `overflow ${overflow}px`);
  const barBox = await mp.locator("form .sticky").last().boundingBox();
  const tabs = await mp
    .locator("nav.fixed, nav[class*='fixed']")
    .last()
    .boundingBox()
    .catch(() => null);
  check(
    "on a phone the bar sits above the tab bar",
    tabs ? barBox.y + barBox.height <= tabs.y + 1 : true,
    tabs
      ? `${Math.round(barBox.y + barBox.height)} vs ${Math.round(tabs.y)}`
      : "no tab bar found",
  );
  await mp.screenshot({ path: `${shots}/job-form-phone.png`, fullPage: false });
  await mc.close();
} finally {
  cleanUp();
}
check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
