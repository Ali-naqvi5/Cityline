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
const flat = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ");
const ahead = (days) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const suffix = String(Date.now()).slice(-5);
const PLATE = `OUT${suffix.slice(-4)}`;
function cleanUp() {
  const ids = sql(
    "select string_agg(id::text, ',') from drivers where last_name = 'Outsourcecheck'",
  );
  if (ids) {
    sql(`delete from driver_documents where driver_id in (${ids})`);
    sql(`delete from vehicles_rels where drivers_id in (${ids})`);
    sql(`delete from drivers where id in (${ids})`);
  }
  const cars = sql(
    "select string_agg(id::text, ',') from vehicles where registration like 'OUT%'",
  );
  if (cars) {
    sql(`delete from vehicle_documents where vehicle_id in (${cars})`);
    sql(`delete from vehicles where id in (${cars})`);
  }
}
cleanUp();

try {
  // Outsourced drivers (Cityline, 10 Oct 2026): their details and car only.
  // Records are kept offline, never asked for and never checked here.
  const { page, context } = await session("controller@local.test");
  await page.goto(`${base}/admin/drivers`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Add outsourced driver" }).click();
  await page.waitForURL(/engagement=outsourced/, { timeout: 30_000 });
  check(
    "'Add outsourced driver' opens with Outsourced chosen and their car asked for",
    (await page.isChecked("#engagement-outsourced")) &&
      (await page.locator("#registration").count()) === 1,
  );
  check(
    "only the PHV licence number is offered, and it is optional",
    (await page.locator("#phvLicenceNumber").count()) === 1 &&
      !(await page.locator("#phvLicenceNumber").getAttribute("required")),
  );
  check(
    "no licence dates, certificate or insurance is asked for",
    (await page
      .locator(
        "#phvNumber, #phvExpiry, #dvlaNumber, #dvlaExpiry, #vehicleLicenceNumber, #vehicleLicenceExpiry, #motExpiry, #insuranceExpiry, #seenOriginals",
      )
      .count()) === 0,
  );

  await page.fill("#firstName", "Olu");
  await page.fill("#lastName", "Outsourcecheck");
  await page.fill("#phone", `07700 9${suffix}`);
  await page.getByRole("button", { name: "Add driver and car" }).click();
  await page.getByText("Enter the registration.").waitFor({ timeout: 20_000 });
  check("their car is required", true);

  await page.fill("#address", "1 Check Road, Hayes UB3 1AA");
  await page.fill("#dateOfBirth", "1980-05-04");
  await page.fill("#nationalInsuranceNumber", "AB 12 34 56 C");
  await page.fill("#startDate", ahead(0));
  await page.fill("#phvLicenceNumber", `phv ${suffix}`);
  await page.fill("#registration", PLATE);
  await page.selectOption("#vehicleClassSlug", "mpv-8");
  await page.fill("#make", "Mercedes");
  await page.fill("#model", "Vito");
  await page.fill("#colour", "Black");
  await page.fill("#seats", "8");
  await page.getByRole("button", { name: "Add driver and car" }).click();
  await page.waitForURL(/\/admin\/drivers\/\d+\?notice=created/, { timeout: 30_000 });
  const driverId = Number(page.url().match(/drivers\/(\d+)/)[1]);

  check(
    "the driver is saved as outsourced, with their PHV number and no documents",
    sql(
      `select engagement || ':' || phv_licence_number from drivers where id = ${driverId}`,
    ) === `outsourced:PHV${suffix}` &&
      sql(`select count(*) from driver_documents where driver_id = ${driverId}`) === "0",
  );
  const carId = Number(sql(`select id from vehicles where registration = '${PLATE}'`));
  check(
    "their car is saved, linked to them, with no documents",
    carId > 0 &&
      sql(
        `select count(*) from vehicles_rels where parent_id = ${carId} and drivers_id = ${driverId}`,
      ) === "1" &&
      sql(`select count(*) from vehicle_documents where vehicle_id = ${carId}`) === "0",
  );
  let body = await flat(page);
  check(
    "the driver's page says nothing is checked, and the TfL record is complete",
    /Outsourced/.test(body) &&
      /Nothing is checked here/.test(body) &&
      !(await page.getByRole("heading", { name: "Add a document" }).count()) &&
      /Complete: every particular TfL asks for is on record/.test(body) &&
      /Kept offline by the office: copy of driving licence, copy of PHV driver's licence, photograph/.test(
        body,
      ),
  );
  await page.screenshot({ path: `${shots}/outsourced-driver.png`, fullPage: true });
  await page.goto(`${base}/admin/vehicles/${carId}`, { waitUntil: "networkidle" });
  check(
    "their car's page says nothing is checked either",
    /Nothing is checked here/.test(await flat(page)),
  );

  await page.goto(`${base}/admin/drivers?type=outsourced`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "the drivers list filters to outsourced drivers, shown as kept offline",
    body.includes("Olu Outsourcecheck") &&
      !body.includes("Sam Taylor") &&
      /Kept offline/.test(body),
  );
  await page.goto(`${base}/admin/compliance`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "Compliance never lists them or their car",
    !body.includes("Olu Outsourcecheck") && !body.includes(PLATE),
  );

  // A job they can do, by class, straight away and never blocked.
  const job = Number(
    sql(
      "select id from jobs where is_test = false and status = 'unassigned' and driver_id is null and vehicle_class_slug in ('saloon','estate','mpv-5','mpv-8') and pickup_at > now() order by pickup_at limit 1",
    ),
  );
  await page.goto(`${base}/admin/jobs/${job}/assign`, { waitUntil: "networkidle" });
  await page.fill("#assign-search", "Outsourcecheck");
  const row = (
    await page.locator('ul[aria-label="Drivers"] > li').first().innerText()
  ).replace(/\s+/g, " ");
  check(
    "they can be given a job straight away, never blocked on documents",
    row.includes("Olu Outsourcecheck") && !row.includes("Cannot go"),
    row,
  );

  // A partial save never leaves half a driver: a taken registration rolls it all back.
  const before = sql("select count(*) from drivers");
  await page.goto(`${base}/admin/drivers/new?engagement=outsourced`, {
    waitUntil: "networkidle",
  });
  await page.fill("#firstName", "Twice");
  await page.fill("#lastName", "Outsourcecheck");
  await page.fill("#phone", `07700 8${suffix}`);
  for (const [id, value] of [
    ["#registration", PLATE],
    ["#make", "Ford"],
    ["#model", "Galaxy"],
    ["#colour", "Grey"],
  ]) {
    await page.fill(id, value);
  }
  await page.selectOption("#vehicleClassSlug", "mpv-5");
  await page.getByRole("button", { name: "Add driver and car" }).click();
  await page.getByText(/already on record/).waitFor({ timeout: 20_000 });
  check(
    "a car already on record stops the save, and nothing half-saved remains",
    sql("select count(*) from drivers") === before,
  );

  const csv = await page.evaluate(async () => {
    const response = await fetch("/api/reports/drivers?data=records");
    return { status: response.status, body: await response.text() };
  });
  const line =
    csv.body.split(/\r?\n/).find((row) => row.includes("Outsourcecheck")) ?? "";
  check(
    "TfL's driver records CSV marks them outsourced, copies kept offline",
    csv.status === 200 && /Outsourced/.test(line) && /Kept offline/.test(line),
    line.slice(0, 160),
  );
  await context.close();

  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}/admin/drivers/new?engagement=outsourced`, {
    waitUntil: "networkidle",
  });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check("the form fits a phone", overflow <= 0, `overflow ${overflow}px`);
  await mc.close();
} finally {
  cleanUp();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
