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
/** A London wall-clock time on a London date, as an ISO instant. */
function londonIso(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  })
    .formatToParts(guess)
    .find((part) => part.type === "timeZoneName").value; // "GMT+1" or "GMT"
  const hours = Number(offset.replace("GMT", "") || 0);
  return new Date(guess.getTime() - hours * 3_600_000).toISOString();
}
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
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
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

// --- Fixtures: tomorrow's bookings (local database only) ---------------------------
const RUN_PHONE = "+447700900661";
sql(
  `delete from job_events where job_id in (select id from jobs where lead_phone = '${RUN_PHONE}')`,
);
sql(`delete from jobs where lead_phone = '${RUN_PHONE}'`);
const date = day(1);
const sam = Number(sql("select id from drivers where phone = '+447700900456'"));
const priya = Number(sql("select id from drivers where phone = '+447700900458'"));
const vehicle = Number(sql("select id from vehicles where registration = 'CD34EFG'"));
// Every car is one driver's own: Priya drives hers.
const priyaCar = Number(sql("select id from vehicles where registration = 'EF56GHJ'"));
sql(`update vehicles set status = 'active' where id = ${vehicle}`);
const token = await login("controller@local.test");
let serial = 0;
async function booking(time, extra = {}) {
  serial += 1;
  const response = await api("/api/jobs", token, {
    method: "POST",
    body: JSON.stringify({
      reference: `J-R${Date.now().toString().slice(-5)}${serial}`,
      source: "phone",
      status: "unassigned",
      pickupAt: londonIso(date, time),
      pickupAddress: "Heathrow Terminal 5",
      dropoffAddress: "10 Wren Avenue, Uxbridge UB8 1AA",
      vehicleClassSlug: "saloon",
      passengers: 2,
      largeBags: 1,
      smallBags: 1,
      leadName: "Run Sheet Passenger",
      leadPhone: RUN_PHONE,
      customerPricePence: 6000,
      paymentMethod: "card_link",
      ...extra,
    }),
  });
  if (response.status !== 201) console.log(JSON.stringify(response.body).slice(0, 300));
  return response.body?.doc?.id;
}
const early = await booking("10:00", {
  flightNumber: "EK009",
  driverNotes: "Wait at the café",
});
const close = await booking("10:45");
const noDriver = await booking("13:00");
const priyaJob = await booking("15:00");
const cancelledJob = await booking("16:00");
const testJob = await booking("17:00", { isTest: true });
for (const id of [early, close]) {
  await api(`/api/jobs/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ driver: sam, vehicle }),
  });
}
await api(`/api/jobs/${early}`, token, {
  method: "PATCH",
  body: JSON.stringify({ driverPricePence: 3500, status: "driver_confirmed" }),
});
await api(`/api/jobs/${priyaJob}`, token, {
  method: "PATCH",
  body: JSON.stringify({ driver: priya, vehicle: priyaCar }),
});
await api(`/api/jobs/${cancelledJob}`, token, {
  method: "PATCH",
  body: JSON.stringify({ status: "cancelled", cancelReason: "Plans changed" }),
});
check(
  "tomorrow's bookings are set up",
  sql(
    `select string_agg(status::text, ',' order by pickup_at) from jobs where lead_phone = '${RUN_PHONE}'`,
  ) === "driver_confirmed,assigned,unassigned,assigned,cancelled,unassigned",
  sql(
    `select string_agg(status::text, ',' order by pickup_at) from jobs where lead_phone = '${RUN_PHONE}'`,
  ),
);
const refs = Object.fromEntries(
  sql(`select id || '=' || reference from jobs where lead_phone = '${RUN_PHONE}'`)
    .split("\n")
    .map((line) => line.split("=")),
);

// --- Today by default ----------------------------------------------------------------
const { page, context } = await session("controller@local.test");
await page.goto(`${base}/admin/reports/run-sheet`, { waitUntil: "networkidle" });
let body = await text(page);
const todayHeading = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());
check(
  "the run sheet opens on today",
  body.includes(`${todayHeading.replace(",", "")}`) && /\(today\)/.test(body),
);

// --- Tomorrow, whole day --------------------------------------------------------------
await page.click('a[aria-label="The day after"]');
await page.waitForURL(/date=/, { timeout: 15_000 });
await page.waitForLoadState("networkidle");
body = await text(page);
const order = [early, close, noDriver, priyaJob].map((id) => refs[id]);
const list = await page.locator("main section").last().innerText();
const positions = order.map((ref) => list.indexOf(ref));
check(
  "the next day lists its bookings in pickup order",
  positions.every((position) => position >= 0) &&
    positions.every((position, index) => index === 0 || position > positions[index - 1]),
  JSON.stringify(positions),
);
const cancelledTomorrow = Number(
  sql(
    `select count(*) from jobs where is_test = false and archived_at is null and status = 'cancelled' and (pickup_at at time zone 'Europe/London')::date = '${date}'`,
  ),
);
check(
  "cancelled and test bookings are left out, the cancelled ones counted",
  !body.includes(refs[cancelledJob]) &&
    !body.includes(refs[testJob]) &&
    body.includes(`${cancelledTomorrow} cancelled, not shown`),
  `${cancelledTomorrow} cancelled in the database`,
);
check(
  "each booking shows the passenger's phone, flight, route and notes",
  body.includes(RUN_PHONE) &&
    /EK009/.test(body) &&
    /Wait at the café/.test(body) &&
    /10 Wren Avenue/.test(body),
);
check(
  "what needs attention is listed first",
  /Needs attention/.test(body) &&
    /No driver yet/.test(body) &&
    /Priya Shah has not confirmed/.test(body) &&
    /Sam Taylor has 45 min between/.test(body),
);
check("there are no prices on the sheet", !/£/.test(body));

// A car off the road shows on the bookings it is meant for.
sql(`update vehicles set status = 'off_road' where id = ${vehicle}`);
await page.reload({ waitUntil: "networkidle" });
body = await text(page);
check(
  "a car taken off the road shows against its bookings",
  /CD34EFG is off the road/.test(body),
);
sql(`update vehicles set status = 'active' where id = ${vehicle}`);
await page.screenshot({ path: `${shots}/run-sheet-day.png`, fullPage: true });

// --- By driver ----------------------------------------------------------------------
await page.getByRole("link", { name: "By driver" }).click();
await page.waitForURL(/view=driver/, { timeout: 15_000 });
await page.waitForLoadState("networkidle");
body = await text(page);
check(
  "by driver, each driver has their day with the time between pickups",
  /Sam Taylor/.test(body) &&
    /45 min to the next pickup — tight/.test(body) &&
    /No driver yet/.test(body),
);
const sendHref = await page
  .getByRole("link", { name: "Send day on WhatsApp" })
  .first()
  .getAttribute("href");
const message = decodeURIComponent(sendHref.split("text=")[1] ?? "");
check(
  "the driver's day goes on WhatsApp with their price and the passenger's number",
  sendHref.startsWith("https://wa.me/447700900456") &&
    /\*YOUR JOBS · /.test(message) &&
    message.includes(refs[early]) &&
    message.includes(refs[close]) &&
    message.includes("Your price: £35.00") &&
    message.includes(RUN_PHONE),
);
check(
  "a driver who has not agreed to WhatsApp is not offered it",
  /Has not agreed to WhatsApp messages/.test(body),
);
await page.emulateMedia({ media: "print" });
const breaks = await page.evaluate(() =>
  [...document.querySelectorAll("main section")].map(
    (section) => getComputedStyle(section).breakBefore,
  ),
);
check(
  "printed, each driver starts a new page",
  breaks.filter((value) => value === "page").length >= 2,
  breaks.join(","),
);
await page.screenshot({ path: `${shots}/run-sheet-print.png`, fullPage: true });
await page.emulateMedia({ media: "screen" });
await page.screenshot({ path: `${shots}/run-sheet-driver.png`, fullPage: true });

// --- The CSV -------------------------------------------------------------------------
const csv = await page.evaluate(async (href) => {
  const response = await fetch(href);
  return {
    status: response.status,
    disposition: response.headers.get("content-disposition"),
    body: await response.text(),
  };
}, `/api/reports/run-sheet?date=${date}`);
const lines = csv.body.trim().split("\r\n");
const expectedRows = Number(
  sql(
    `select count(*) from jobs where is_test = false and archived_at is null and status <> 'cancelled' and (pickup_at at time zone 'Europe/London')::date = '${date}'`,
  ),
);
check(
  "the CSV has every booking of the day, with phones and no prices",
  csv.status === 200 &&
    csv.disposition.includes(`cityline-run-sheet-${date}.csv`) &&
    lines.length === expectedRows + 1 &&
    lines[0].includes("Passenger phone") &&
    !/price|£/i.test(csv.body),
  `${lines.length - 1} rows, expected ${expectedRows}`,
);
await context.close();

// --- Who may see it --------------------------------------------------------------------
for (const email of ["accounts@local.test", "editor@local.test"]) {
  const { page: other, context: otherContext } = await session(email);
  await other.goto(`${base}/admin/reports/run-sheet`, { waitUntil: "networkidle" });
  const status = await other.evaluate(
    async () => (await fetch("/api/reports/run-sheet")).status,
  );
  check(
    `${email.split("@")[0]} cannot open or download the run sheet`,
    /You do not have access to this/.test(await text(other)) && status === 403,
  );
  await otherContext.close();
}
check(
  "signed out, the download is refused",
  (await fetch(`${base}/api/reports/run-sheet`)).status === 403,
);

// --- Phones and dark ------------------------------------------------------------------
for (const view of ["", "&view=driver"]) {
  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}/admin/reports/run-sheet?date=${date}${view}`, {
    waitUntil: "networkidle",
  });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(
    `fits a phone${view ? " (by driver)" : ""}`,
    overflow <= 0,
    `overflow ${overflow}px`,
  );
  if (!view)
    await mp.screenshot({ path: `${shots}/run-sheet-phone.png`, fullPage: true });
  await mc.close();
}
sql("update users set ops_theme = 'dark' where email = 'controller@local.test'");
{
  const { page: dp, context: dc } = await session("controller@local.test");
  await dp.goto(`${base}/admin/reports/run-sheet?date=${date}&view=driver`, {
    waitUntil: "networkidle",
  });
  await dp.screenshot({ path: `${shots}/run-sheet-dark.png`, fullPage: true });
  await dc.close();
}
sql("update users set ops_theme = 'light' where email = 'controller@local.test'");

// Leave no bookings behind for the other checks (local database only).
sql(
  `delete from job_events where job_id in (select id from jobs where lead_phone = '${RUN_PHONE}')`,
);
sql(`delete from jobs where lead_phone = '${RUN_PHONE}'`);

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
