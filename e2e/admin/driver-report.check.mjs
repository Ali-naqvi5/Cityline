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
async function login(email) {
  const response = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await response.json()).token;
}
async function api(path, token, init = {}) {
  const response = await fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {}
  return { status: response.status, body };
}

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

// --- Fixtures (local database only) ----------------------------------------------
const sam = Number(sql("select id from drivers where phone = '+447700900456'"));
check("the fleet test driver exists", sam > 0);
sql(
  `update drivers set national_insurance_number = null, photo_id = null where id = ${sam}`,
);
const LEAVER_PHONE = "+447700900459";
sql(
  `update job_events set driver_taken_off_id = null where driver_taken_off_id in (select id from drivers where phone = '${LEAVER_PHONE}')`,
);
sql(`delete from drivers where phone = '${LEAVER_PHONE}'`);
const ownerToken = await login("owner@local.test");
const leaver = await api("/api/drivers", ownerToken, {
  method: "POST",
  body: JSON.stringify({
    firstName: "Lee",
    lastName: "Leaver",
    phone: LEAVER_PHONE,
    status: "active",
  }),
});
const leaverId = leaver.body?.doc?.id;
check("a driver to mark as left is added", leaver.status === 201);

// --- The TfL driver record on the driver's page -----------------------------------
const { page, context } = await session("controller@local.test");
await page.goto(`${base}/admin/drivers/${sam}`, { waitUntil: "networkidle" });
let body = await text(page);
check(
  "the driver's page lists what TfL's record is missing",
  /TfL driver record/.test(body) &&
    /National Insurance number/.test(body) &&
    /Photograph/.test(body) &&
    /particulars? missing/.test(body),
);

await page.goto(`${base}/admin/drivers/${sam}/edit`, { waitUntil: "networkidle" });
await page.fill("#nationalInsuranceNumber", "QQ123456C");
await page.getByRole("button", { name: "Save changes" }).click();
await page
  .getByText("Enter a valid National Insurance number")
  .waitFor({ timeout: 15_000 });
check("an NI number HMRC never issues is refused", true);
await page.fill("#nationalInsuranceNumber", "ab 12 34 56 c");
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(/notice=saved/, { timeout: 15_000 });
body = await text(page);
check(
  "the NI number is stored without spaces and shown as HMRC prints it",
  sql(`select national_insurance_number from drivers where id=${sam}`) === "AB123456C" &&
    /AB 12 34 56 C/.test(body),
);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
await page.setInputFiles("#driver-photo", {
  name: "sam.png",
  mimeType: "image/png",
  buffer: png,
});
await page.getByRole("button", { name: "Save photo" }).click();
await page.waitForURL(/notice=photo-saved/, { timeout: 20_000 });
check(
  "a photograph can be uploaded, as a private file",
  sql(
    `select f.purpose from drivers d join private_files f on f.id = d.photo_id where d.id=${sam}`,
  ) === "driver_photo" && (await page.getByAltText("Photo of Sam Taylor").count()) === 1,
);
const photoStatus = await page.evaluate(async () => {
  const img = document.querySelector('img[alt="Photo of Sam Taylor"]');
  return (await fetch(img.src)).status;
});
const anonymousPhoto = await fetch(
  new URL(await page.getByAltText("Photo of Sam Taylor").getAttribute("src"), base),
);
check(
  "the photo is served to staff, never to the public",
  photoStatus === 200 && anonymousPhoto.status !== 200,
  `staff ${photoStatus}, signed out ${anonymousPhoto.status}`,
);

// Leaving: the stop date is required; conduct means telling TfL.
await page.goto(`${base}/admin/drivers/${leaverId}/edit`, { waitUntil: "networkidle" });
await page.selectOption("#status", "left");
await page.getByRole("button", { name: "Save changes" }).click();
await page
  .getByText("Enter the date they stopped being available")
  .first()
  .waitFor({ timeout: 15_000 });
check("marking a driver as left needs the date they stopped", true);
const apiLeft = await api(`/api/drivers/${leaverId}`, ownerToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "left" }),
});
check(
  "…on the API too",
  apiLeft.status === 400 && /stopped being available/.test(JSON.stringify(apiLeft.body)),
  `status ${apiLeft.status}`,
);
await page.fill("#endDate", day(-2));
await page.fill("#leftReason", "Repeated complaints about driving");
await page.check("#leftForConduct");
check(
  "ticking conduct explains the 14-day notice to TfL",
  /within 14 days/.test(await text(page)) &&
    (await page.locator("#tflToldAt").count()) === 1,
);
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(/notice=saved/, { timeout: 15_000 });
body = await text(page);
const due = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
}).format(new Date(`${day(12)}T12:00:00Z`));
check(
  "the driver's page says when TfL must be told",
  /Tell TfL by/.test(body) && body.includes(due) && /PHV\/105/.test(body),
  due,
);
check("and how long the record is kept", /Keep this record until/.test(body));

// --- Who sees the NI number --------------------------------------------------------
{
  const { page: ap, context: ac } = await session("accounts@local.test");
  const accountsPage = await ap.goto(`${base}/admin/drivers/${sam}`, {
    waitUntil: "networkidle",
  });
  const accountsBody = await text(ap);
  check(
    "Accounts can open a driver's page (no vehicles, which they cannot see)",
    accountsPage.status() === 200 &&
      /Sam Taylor/.test(accountsBody) &&
      /Details/.test(accountsBody) &&
      !accountsBody.includes("No vehicle linked") &&
      !accountsBody.includes("CD34EFG"),
    `status ${accountsPage.status()}`,
  );
  const viaApi = await ap.evaluate(
    async (id) => (await fetch(`/api/drivers/${id}`)).json(),
    sam,
  );
  check(
    "Accounts never sees a National Insurance number",
    !/AB 12 34 56 C/.test(accountsBody) &&
      !/TfL driver record/.test(accountsBody) &&
      !("nationalInsuranceNumber" in viaApi),
  );
  await ap.goto(`${base}/admin/reports/drivers`, { waitUntil: "networkidle" });
  check(
    "Accounts cannot open the Driver Report",
    /You do not have access to this/.test(await text(ap)),
  );
  const status = await ap.evaluate(
    async () => (await fetch("/api/reports/drivers?data=records")).status,
  );
  check("…nor download the TfL records", status === 403, `status ${status}`);
  await ac.close();
}
const anonymous = await fetch(`${base}/api/reports/drivers?data=records`);
check("the TfL records refuse someone signed out", anonymous.status === 403);

// --- The Driver Report -------------------------------------------------------------
const from = day(-29);
const to = day(7);
const inPeriod = `is_test = false and (pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}'`;
const expected = {
  driven: Number(
    sql(
      `select count(*) from jobs where ${inPeriod} and driver_id is not null and status in ('completed','no_show')`,
    ),
  ),
  withDriver: Number(
    sql(`select count(*) from jobs where ${inPeriod} and driver_id is not null`),
  ),
  takenOff: Number(
    sql(
      `select count(*) from job_events e join jobs j on j.id = e.job_id where e.driver_taken_off_id is not null and j.is_test = false and (j.pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}'`,
    ),
  ),
  arrivals: Number(
    sql(
      `select count(*) from jobs where ${inPeriod} and driver_id is not null and at_pickup_at is not null`,
    ),
  ),
  onTime: Number(
    sql(
      `select count(*) from jobs where ${inPeriod} and driver_id is not null and at_pickup_at is not null and round(extract(epoch from (at_pickup_at - pickup_at)) / 60) <= 15`,
    ),
  ),
};
console.log("expected", JSON.stringify(expected));

await page.goto(`${base}/admin/reports/drivers?from=${from}&to=${to}`, {
  waitUntil: "networkidle",
});
body = await text(page);
const tile = async (label) =>
  (
    await page
      .locator("div.rounded-xl", { has: page.getByText(label, { exact: true }) })
      .first()
      .locator("p")
      .nth(1)
      .innerText()
  ).trim();
const onTimeShown = await tile("On time at pickup");
check(
  "the headline figures match the database, test bookings left out",
  Number(await tile("Bookings driven")) === expected.driven &&
    Number(await tile("Taken off bookings")) === expected.takenOff &&
    onTimeShown ===
      (expected.arrivals
        ? `${Math.round((expected.onTime / expected.arrivals) * 100)}%`
        : "—"),
  `driven ${await tile("Bookings driven")}/${expected.driven}, taken off ${await tile("Taken off bookings")}/${expected.takenOff}, on time ${onTimeShown}`,
);
check(
  "on time allows 15 minutes' grace, and says so",
  /Up to 15 minutes after it counts as on time/.test(body),
);
check("there are no prices anywhere in the report", !/£/.test(body));
check(
  "the reasons drivers were taken off are shown as written",
  /Passenger asked for a larger car/.test(body) &&
    /Sam's car is in for repair/.test(body),
);
check(
  "the TfL records list the driver who left, with the notice owed",
  /TfL driver records/.test(body) &&
    /Lee Leaver/.test(body) &&
    /form PHV\/105/.test(body),
);
const cell = page.locator("td [data-tip-value]").first();
if (await cell.count()) {
  await cell.hover();
  await page.getByRole("tooltip").waitFor({ timeout: 5_000 });
  check(
    "hovering a day shows the driver's bookings",
    /\d+ bookings?/.test(await page.getByRole("tooltip").innerText()),
  );
} else {
  check("the bookings-by-day grid has cells", false);
}
await page.screenshot({ path: `${shots}/report-drivers.png`, fullPage: true });

// One driver.
await page.goto(`${base}/admin/reports/drivers?from=${from}&to=${to}&driver=${sam}`, {
  waitUntil: "networkidle",
});
check(
  "a driver filter narrows the report to that driver",
  Number(await tile("Drivers who worked")) <= 1 &&
    !/Priya Shah/.test(await page.locator("table").first().innerText()),
);

// The raw data.
const fetchCsv = (query) =>
  page.evaluate(async (href) => {
    const response = await fetch(href);
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      disposition: response.headers.get("content-disposition"),
      body: await response.text(),
    };
  }, `/api/reports/drivers?from=${from}&to=${to}${query}`);
const bookingsCsv = await fetchCsv("");
const bookingLines = bookingsCsv.body.trim().split("\r\n");
check(
  "the bookings CSV has every booking with a driver, and no money",
  bookingsCsv.status === 200 &&
    /attachment; filename="cityline-driver-bookings-/.test(bookingsCsv.disposition) &&
    bookingLines.length === expected.withDriver + 1 &&
    bookingLines[0].includes("Minutes after pickup time at DAP") &&
    !/price|£/i.test(bookingsCsv.body),
  `${bookingLines.length - 1} rows, expected ${expected.withDriver}`,
);
const driversCsv = await fetchCsv("&data=drivers");
check(
  "the drivers CSV has one row per driver",
  driversCsv.status === 200 &&
    driversCsv.body.includes("Driver,Status,Jobs done,Last job,Bookings,Completed"),
);
const takenOffCsv = await fetchCsv("&data=taken-off");
check(
  "the taken-off CSV carries each reason",
  takenOffCsv.status === 200 &&
    takenOffCsv.body.includes("Passenger asked for a larger car") &&
    takenOffCsv.body.split("\r\n").filter(Boolean).length === expected.takenOff + 1,
);
const recordsCsv = await fetchCsv("&data=records");
const samLine = recordsCsv.body
  .split("\r\n")
  .find((line) => line.startsWith("Taylor,Sam"));
check(
  "the TfL records CSV holds every particular TfL asks for",
  recordsCsv.status === 200 &&
    /filename="cityline-tfl-driver-records-/.test(recordsCsv.disposition) &&
    recordsCsv.body.includes(
      "Surname,Forenames,Status,Type,Address,Date of birth,National Insurance number,Driving licence number",
    ) &&
    Boolean(samLine?.includes("AB 12 34 56 C")) &&
    recordsCsv.body.includes("Lee") &&
    recordsCsv.body.includes("Repeated complaints about driving"),
);

// --- Drivers and their jobs ---------------------------------------------------------
const londonDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const pounds = (pence) =>
  `£${Math.floor(pence / 100).toLocaleString("en-GB")}.${String(pence % 100).padStart(2, "0")}`;
const samDone = `${inPeriod} and driver_id = ${sam} and status in ('completed','no_show')`;
const samJobs = Number(sql(`select count(*) from jobs where ${samDone}`));
const samLast = sql(`select max(pickup_at) from jobs where ${samDone}`);
const samOffered = Number(
  sql(`select coalesce(sum(driver_price_pence), 0) from jobs where ${samDone}`),
);
const samUnpriced = Number(
  sql(`select count(*) from jobs where ${samDone} and driver_price_pence is null`),
);
console.log("sam", samJobs, samLast, samOffered, samUnpriced);

await page.goto(`${base}/admin/reports/drivers?from=${from}&to=${to}`, {
  waitUntil: "networkidle",
});
const list = page
  .locator("section")
  .filter({ has: page.getByRole("heading", { name: "Drivers and their jobs" }) })
  .first();
const listText = (await list.innerText()).replace(/\s+/g, " ");
const working = sql(
  "select string_agg(full_name, '|') from drivers where status <> 'left'",
).split("|");
check(
  "the Driver Report opens with every driver still working and their jobs",
  working.every((name) => listText.includes(name)) &&
    /Jobs done/.test(listText) &&
    /Last job/.test(listText),
  working.filter((name) => !listText.includes(name)).join(", "),
);
const samRow = (
  await page
    .locator("tr", { has: page.getByRole("link", { name: "Sam Taylor", exact: true }) })
    .first()
    .innerText()
).replace(/\s+/g, " ");
check(
  "each driver shows their jobs done and last job date",
  samRow.startsWith(
    `Sam Taylor ${samJobs} ${samLast ? londonDay.format(new Date(samLast)) : "—"}`,
  ),
  samRow,
);
check(
  "the list carries no money and no paid status",
  !/£|\bpaid\b|unpaid/i.test(listText),
);

await page.getByRole("link", { name: "Sam Taylor", exact: true }).first().click();
await page.waitForURL(
  new RegExp(`/admin/reports/drivers/${sam}\\?from=${from}&to=${to}`),
  { timeout: 30_000 },
);
const main = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");
body = await main();
check(
  "clicking a driver opens their jobs, keeping the dates",
  /Sam Taylor/.test(body) && /Jobs done/.test(body),
  page.url(),
);
check(
  "with date filters",
  (await page.locator("#report-period").count()) === 1 &&
    (await page.inputValue("#report-from")) === from &&
    (await page.inputValue("#report-to")) === to,
);
const jobRows = page.locator("tbody tr");
check(
  "every job they did in the dates is listed, newest first",
  (await jobRows.count()) === Math.min(samJobs, 50) &&
    Number(await tile("Jobs done")) === samJobs,
  `${await jobRows.count()} rows, ${samJobs} expected`,
);
check(
  "each shows what it was offered to them for, with the total",
  (await tile("Driver pay offered")) === pounds(samOffered) &&
    (samJobs === 0 || body.includes(`Total offered ${pounds(samOffered)}`)) &&
    (samUnpriced === 0 || /Not written/.test(body)),
  `${await tile("Driver pay offered")} vs ${pounds(samOffered)}`,
);
check("whether the driver was paid never shows", !/\bpaid\b|unpaid|payment/i.test(body));
await page.screenshot({ path: `${shots}/report-driver-jobs.png`, fullPage: true });

const jobsCsv = await page.evaluate(async (href) => {
  const response = await fetch(href);
  return {
    status: response.status,
    disposition: response.headers.get("content-disposition"),
    body: await response.text(),
  };
}, `/api/reports/driver-jobs?from=${from}&to=${to}&driver=${sam}`);
const jobLines = jobsCsv.body.trim().split("\r\n");
check(
  "the driver's jobs download as CSV with the driver price, and nothing about payment",
  jobsCsv.status === 200 &&
    /filename="cityline-driver-\d+-jobs-/.test(jobsCsv.disposition) &&
    jobLines[0] ===
      "Pickup date,Pickup time,Booking,Pickup,Drop-off,Status,Vehicle,Driver price (£)" &&
    jobLines.length === samJobs + 1 &&
    !/\bpaid\b|unpaid/i.test(jobsCsv.body),
  `${jobLines.length - 1} rows`,
);

// A narrower date: the filter applies.
const quiet = "2020-01-01";
await page.goto(`${base}/admin/reports/drivers/${sam}?from=${quiet}&to=${quiet}`, {
  waitUntil: "networkidle",
});
check(
  "a date with no work says so",
  /No jobs done in these dates/.test(await main()) && (await tile("Jobs done")) === "0",
);
await page.goto(`${base}/admin/reports/drivers/999999`, { waitUntil: "networkidle" });
check(
  "an unknown driver is said plainly",
  /No driver with that number/.test(await main()),
);
await context.close();

{
  const { page: ap, context: ac } = await session("accounts@local.test");
  await ap.goto(`${base}/admin/reports/drivers/${sam}`, { waitUntil: "networkidle" });
  const status = await ap.evaluate(
    async (id) => (await fetch(`/api/reports/driver-jobs?driver=${id}`)).status,
    sam,
  );
  check(
    "Accounts cannot open a driver's jobs or download them",
    /You do not have access to this/.test(await text(ap)) && status === 403,
    `status ${status}`,
  );
  await ac.close();
}

// --- Dark, and phones --------------------------------------------------------------
sql("update users set ops_theme = 'dark' where email = 'controller@local.test'");
{
  const { page: dp, context: dc } = await session("controller@local.test");
  await dp.goto(`${base}/admin/reports/drivers?from=${from}&to=${to}`, {
    waitUntil: "networkidle",
  });
  await dp.screenshot({ path: `${shots}/report-drivers-dark.png`, fullPage: true });
  await dc.close();
}
sql("update users set ops_theme = 'light' where email = 'controller@local.test'");
for (const path of [
  `/admin/reports/drivers?from=${from}&to=${to}`,
  `/admin/reports/drivers/${sam}?from=${from}&to=${to}`,
  `/admin/drivers/${sam}`,
  `/admin/drivers/${leaverId}/edit`,
]) {
  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`fits a phone: ${path.split("?")[0]}`, overflow <= 0, `overflow ${overflow}px`);
  if (path.startsWith("/admin/reports")) {
    await mp.screenshot({ path: `${shots}/report-drivers-phone.png`, fullPage: true });
  }
  await mc.close();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
