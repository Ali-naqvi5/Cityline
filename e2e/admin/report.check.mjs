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
const day = (offset) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
    new Date(Date.now() + offset * 86_400_000),
  );

const browser = await chromium.launch();
const errors = [];
async function session(email, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  await context.request.post(`${base}/api/users/login`, {
    data: { email, password: PASSWORD },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push(`${email} ${page.url().replace(base, "")}: ${String(e).slice(0, 160)}`),
  );
  return { context, page };
}
const text = (page) => page.locator("body").innerText();
const inPeriod = (from, to, extra = "") =>
  Number(
    sql(
      `select count(*) from jobs where is_test = false and (pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}' ${extra}`,
    ),
  );

const from = day(-29);
const to = day(0);
const expected = {
  bookings: inPeriod(from, to),
  completed: inPeriod(from, to, "and status = 'completed'"),
  noShows: inPeriod(from, to, "and status = 'no_show'"),
  cancelled: inPeriod(from, to, "and status = 'cancelled'"),
  withTest: Number(
    sql(
      `select count(*) from jobs where (pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}'`,
    ),
  ),
};
console.log("expected", JSON.stringify(expected));

const { page, context } = await session("controller@local.test");
await page.goto(`${base}/admin/reports/jobs?period=last_30`, {
  waitUntil: "networkidle",
});
let body = await text(page);
const tile = async (label) =>
  Number(
    (
      await page
        .locator("div.rounded-xl", { has: page.getByText(label, { exact: true }) })
        .first()
        .locator("p")
        .nth(1)
        .innerText()
    ).trim(),
  );
check(
  "the headline figures match the database, test bookings left out",
  (await tile("Bookings")) === expected.bookings &&
    (await tile("Completed")) === expected.completed &&
    (await tile("Passenger no-shows (PNS)")) === expected.noShows &&
    (await tile("Cancelled")) === expected.cancelled &&
    expected.withTest !== expected.bookings,
  `page ${await tile("Bookings")}, database ${expected.bookings} (${expected.withTest} with tests)`,
);
check(
  "each figure is compared with the period before",
  /vs the 30 days before/.test(body),
);
check("there are no prices anywhere in the report", !/£/.test(body));
check(
  "the dashboard has its charts and breakdowns",
  /Bookings per day/.test(body) &&
    /By client/.test(body) &&
    /By service/.test(body) &&
    /By airport/.test(body) &&
    /Busy hours/.test(body) &&
    /How far ahead bookings come in/.test(body),
);
{
  const enteredLate = Number(
    sql(
      `select count(*) from jobs where is_test = false and status <> 'cancelled' and taken_at >= pickup_at and (pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}'`,
    ),
  );
  const shown = /Entered after the pickup time\s+(\d+)/.exec(body);
  check(
    "bookings entered after their pickup are counted on their own",
    enteredLate === 0 ? !shown : Number(shown?.[1]) === enteredLate,
    `page ${shown?.[1] ?? "hidden"}, database ${enteredLate}`,
  );
}
{
  const fits = await page.evaluate(() =>
    [...document.querySelectorAll(`select[id^="report-"], input[id^="report-"]`)].every(
      (field) => field.getBoundingClientRect().width >= 140,
    ),
  );
  check("no filter is squeezed on a wide screen", fits);
}
const column = page.locator("[data-tip-value]").first();
await column.hover();
await page.getByRole("tooltip").waitFor({ timeout: 5_000 });
check(
  "hovering a mark shows its number",
  /\d+ (booking|bookings)/.test(await page.getByRole("tooltip").innerText()),
);
await page.screenshot({ path: `${shots}/report-jobs.png`, fullPage: true });

// Filters scope everything.
await page.goto(`${base}/admin/reports/jobs?period=last_30&status=cancelled`, {
  waitUntil: "networkidle",
});
check(
  "a status filter narrows every figure",
  (await tile("Bookings")) === expected.cancelled,
  `page ${await tile("Bookings")}, database ${expected.cancelled}`,
);

// Chosen dates and presets.
await page.goto(`${base}/admin/reports/jobs`, { waitUntil: "networkidle" });
await page.fill("#report-from", day(-3));
await page.waitForURL(/from=/, { timeout: 15_000 });
await page.waitForLoadState("networkidle");
check(
  "choosing a date switches the period to Chosen dates",
  (await page.inputValue("#report-period")) === "custom",
);
await page.fill("#report-to", day(0));
await page.waitForURL(/to=/, { timeout: 15_000 });
await page.waitForLoadState("networkidle");
check(
  "the chosen dates show as the period",
  (await tile("Bookings")) === inPeriod(day(-3), day(0)),
);
await page.selectOption("#report-period", "last_30");
await page.waitForURL((url) => !url.search.includes("from="), { timeout: 15_000 });
check(
  "picking a preset clears the dates",
  (await page.inputValue("#report-from")) === "",
);

// The raw data, as CSV.
await page.goto(`${base}/admin/reports/jobs?period=last_30`, {
  waitUntil: "networkidle",
});
const csvHref = await page
  .getByRole("link", { name: "Download CSV" })
  .first()
  .getAttribute("href");
const csv = await page.evaluate(async (href) => {
  const response = await fetch(href);
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
    body: await response.text(),
  };
}, csvHref);
const lines = csv.body.trim().split("\r\n");
check(
  "the CSV download has every booking in the period, and no money",
  csv.status === 200 &&
    csv.type.startsWith("text/csv") &&
    /attachment; filename="cityline-jobs-/.test(csv.disposition) &&
    lines.length === expected.bookings + 1 &&
    lines[0].includes("Booking,Website booking,Supplier reference") &&
    !/price|£/i.test(lines[0]),
  `status ${csv.status}, ${lines.length - 1} rows`,
);
await context.close();

// Who may see it.
const anonymous = await fetch(`${base}/api/reports/jobs`);
check(
  "the download refuses someone signed out",
  anonymous.status === 403,
  `status ${anonymous.status}`,
);
{
  const { page: ap, context: ac } = await session("accounts@local.test");
  await ap.goto(`${base}/admin/reports/jobs`, { waitUntil: "networkidle" });
  check(
    "Accounts cannot open the Jobs Report",
    /You do not have access to this/.test(await text(ap)),
  );
  const status = await ap.evaluate(async () => (await fetch("/api/reports/jobs")).status);
  check("…nor download it", status === 403, `status ${status}`);
  await ac.close();
}
{
  const { page: op, context: oc } = await session("owner@local.test");
  await op.goto(`${base}/admin/reports/jobs?period=last_30`, {
    waitUntil: "networkidle",
  });
  check("the owner can open it", /Bookings per day/.test(await text(op)));
  await oc.close();
}

// Dark, and phones.
sql("update users set ops_theme = 'dark' where email = 'controller@local.test'");
{
  const { page: dp, context: dc } = await session("controller@local.test");
  await dp.goto(`${base}/admin/reports/jobs?period=last_30`, {
    waitUntil: "networkidle",
  });
  await dp.screenshot({ path: `${shots}/report-jobs-dark.png`, fullPage: true });
  await dc.close();
}
sql("update users set ops_theme = 'light' where email = 'controller@local.test'");
{
  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}/admin/reports/jobs?period=last_30`, {
    waitUntil: "networkidle",
  });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check("the report fits a phone", overflow <= 0, `overflow ${overflow}px`);
  await mp.screenshot({ path: `${shots}/report-jobs-phone.png`, fullPage: true });
  await mc.close();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
