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
const londonTime = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
const londonDate = (date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date);

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
      ...(init.headers ?? {}),
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
  // WhatsApp links open a new tab to wa.me; never let the test reach it.
  await context.route("https://wa.me/**", (route) => route.abort());
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

// --- Fixtures (local database only) ------------------------------------------------
const TEST_PHONE = "+447700900777";
sql(
  `delete from job_events where job_id in (select id from jobs where lead_phone in ('${TEST_PHONE}','+447700900778'))`,
);
sql(
  `update jobs set return_of_job_id = null where lead_phone in ('${TEST_PHONE}','+447700900778')`,
);
sql(`delete from jobs where lead_phone in ('${TEST_PHONE}','+447700900778')`);
sql(`delete from jobs where supplier_reference like 'DSP-%'`);

const ownerToken = await login("owner@local.test");
const sam = Number(sql("select id from drivers where phone = '+447700900456'"));
check("the fleet test driver exists", sam > 0);
const oldVehicle = Number(sql("select id from vehicles where registration = 'AB12CDE'"));

// Sam's new car, which replaces his old one, and a second driver — without
// WhatsApp consent — with her own car. Every car is one driver's own.
sql(`update vehicles set status = 'active' where id = ${oldVehicle}`);
sql(
  "delete from vehicle_documents where vehicle_id in (select id from vehicles where registration in ('CD34EFG','EF56GHJ'))",
);
sql(
  "delete from vehicles_rels where parent_id in (select id from vehicles where registration in ('CD34EFG','EF56GHJ'))",
);
sql("delete from vehicles where registration in ('CD34EFG','EF56GHJ')");
sql(
  "delete from driver_documents where driver_id in (select id from drivers where phone = '+447700900458')",
);
sql(
  "delete from vehicles_rels where drivers_id in (select id from drivers where phone = '+447700900458')",
);
sql("delete from drivers where phone = '+447700900458'");

const priya = (
  await api("/api/drivers", ownerToken, {
    method: "POST",
    body: JSON.stringify({
      firstName: "Priya",
      lastName: "Shah",
      phone: "07700 900458",
      status: "active",
    }),
  })
).body?.doc?.id;
check("a second driver is set up", Boolean(priya));
const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
for (const [type, number] of [
  ["phv_licence", "PHV-777"],
  ["dvla_licence", "SHAH9"],
  ["dbs", "DBS-1"],
  ["right_to_work", null],
]) {
  await api("/api/driver-documents", ownerToken, {
    method: "POST",
    body: JSON.stringify({
      driver: priya,
      type,
      number,
      expiresAt: type === "right_to_work" ? null : iso(400),
    }),
  });
}
const vehicle = (
  await api("/api/vehicles", ownerToken, {
    method: "POST",
    body: JSON.stringify({
      registration: "CD34 EFG",
      make: "Skoda",
      model: "Superb",
      colour: "Silver",
      vehicleClassSlug: "saloon",
      seats: 4,
      status: "active",
      drivers: [sam],
    }),
  })
).body?.doc?.id;
check("a fully documented car is set up for Sam", Boolean(vehicle));
check(
  "Sam's new car marks his old one no longer used",
  sql(`select status from vehicles where id = ${oldVehicle}`) === "sold",
);
const shared = await api("/api/vehicles", ownerToken, {
  method: "POST",
  body: JSON.stringify({
    registration: "EF56 GHJ",
    make: "Skoda",
    model: "Octavia",
    colour: "Blue",
    vehicleClassSlug: "saloon",
    seats: 4,
    status: "active",
    drivers: [sam, priya],
  }),
});
check(
  "a car cannot belong to two drivers",
  shared.status === 400 &&
    /A car belongs to one driver only/.test(JSON.stringify(shared.body)),
  `status ${shared.status}`,
);
const priyaCar = (
  await api("/api/vehicles", ownerToken, {
    method: "POST",
    body: JSON.stringify({
      registration: "EF56 GHJ",
      make: "Skoda",
      model: "Octavia",
      colour: "Blue",
      vehicleClassSlug: "saloon",
      seats: 4,
      status: "active",
      drivers: [priya],
    }),
  })
).body?.doc?.id;
check("Priya has her own car", Boolean(priyaCar));
for (const car of [vehicle, priyaCar]) {
  for (const [type, days] of [
    ["phv_vehicle_licence", 300],
    ["mot", 200],
    ["insurance", 150],
  ]) {
    await api("/api/vehicle-documents", ownerToken, {
      method: "POST",
      body: JSON.stringify({
        vehicle: car,
        type,
        number: `${type}-1`,
        expiresAt: iso(days),
      }),
    });
  }
}

// --- Create a job (controller) ---------------------------------------------------------
const { page, context } = await session("controller@local.test");
const tomorrow = day(1);

async function fillJob(values) {
  await page.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  await page.selectOption("#source", values.source ?? "phone");
  if (values.supplier) {
    await page.selectOption("#supplier", { label: values.supplier });
    await page.fill("#supplierReference", values.supplierReference);
  }
  await page.fill("#pickupDate", values.date ?? tomorrow);
  await page.fill("#pickupTime", values.time ?? "10:00");
  await page.fill("#pickupAddress", values.pickup ?? "Heathrow Terminal 5");
  await page.fill("#dropoffAddress", values.dropoff ?? "10 Wren Avenue, Uxbridge");
  await page.fill("#flightNumber", values.flight ?? "BA117");
  await page.click(`label[for="vehicleClassSlug-saloon"]`);
  await page.fill("#passengers", values.passengers ?? "2");
  await page.fill("#largeBags", "2");
  await page.fill("#leadName", values.name ?? "Dispatch Test");
  await page.fill("#leadPhone", values.phone ?? "07700 900777");
  await page.fill("#leadEmail", "dispatch.test@example.com");
  await page.fill("#price", values.price ?? "55");
  if (!values.supplier)
    await page.selectOption("#paymentMethod", values.payment ?? "cash");
  await page.fill("#driverNotes", "Call on landing");
}

await fillJob({ passengers: "6" });
await page.getByRole("button", { name: "Create booking" }).click();
await page.getByText("A Saloon takes up to 4 passengers").waitFor({ timeout: 15_000 });
check(
  "too many passengers is refused beside the field, keeping what was typed",
  (await page.inputValue("#leadName")) === "Dispatch Test" &&
    (await page.inputValue("#price")) === "55",
);

await page.fill("#passengers", "2");
await page.getByRole("button", { name: "Create booking" }).click();
await page.waitForURL(/\/admin\/jobs\/\d+\?notice=created/, { timeout: 20_000 });
const jobId = Number(page.url().match(/jobs\/(\d+)/)[1]);
let body = await text(page);
check(
  "a phone job is created, unassigned, taken by the controller",
  /Booking created/.test(body) && /Unassigned/.test(body) && /Carl Controller/.test(body),
);
check(
  "its pickup is stored in UTC from London time",
  sql(
    `select to_char(pickup_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') from jobs where id=${jobId}`,
  ) === `${tomorrow} 10:00`,
);

// Duplicate warning.
await fillJob({});
await page.getByRole("button", { name: "Create booking" }).click();
await page.getByText("This may already be entered").waitFor({ timeout: 15_000 });
body = await text(page);
check(
  "the same passenger and flight is flagged before saving",
  /same passenger phone/.test(body) && /same flight that day/.test(body),
);
await page.getByRole("button", { name: "It is a different trip — save anyway" }).click();
await page.waitForURL(/notice=created/, { timeout: 20_000 });
const duplicateId = Number(page.url().match(/jobs\/(\d+)/)[1]);
check("…and saved only when the controller says it is different", duplicateId !== jobId);

// Cancel the duplicate: the reason is required.
await page.getByRole("button", { name: "Cancel booking" }).click();
await page
  .locator("dialog[open]")
  .getByRole("button", { name: "Cancel booking" })
  .click();
await page.waitForTimeout(500);
check(
  "cancelling without a reason is stopped in the dialog",
  (await page.locator("dialog[open]").count()) === 1 &&
    (await page
      .locator("dialog[open] textarea[name=reason]")
      .evaluate((el) => el.validity.valueMissing)) &&
    sql(`select status from jobs where id=${duplicateId}`) === "unassigned",
);
await page.locator("dialog[open] textarea[name=reason]").fill("Entered twice");
await page
  .locator("dialog[open]")
  .getByRole("button", { name: "Cancel booking" })
  .click();
await page.waitForURL(/notice=status-cancelled/, { timeout: 15_000 });
body = await text(page);
check(
  "with a reason, the job is cancelled and the reason shown",
  /Cancelled/.test(body) && /Entered twice/.test(body) && !/Assign driver/.test(body),
);

// --- Supplier job, duplicate reference, return trip ----------------------------------------
await fillJob({
  source: "supplier",
  supplier: "Trip.com",
  supplierReference: "dsp-100",
  name: "Supplier Passenger",
  phone: "07700 900778",
  flight: "",
  price: "80",
});
check(
  "a supplier job asks for no commission",
  (await page.locator("#commissionPercent").count()) === 0,
);
await page.getByRole("button", { name: "Create booking" }).click();
await page.waitForURL(/notice=created/, { timeout: 20_000 });
const supplierJob = Number(page.url().match(/jobs\/(\d+)/)[1]);
check(
  "the supplier job keeps its whole price: partners take their cut first",
  sql(
    `select supplier_reference || ' ' || customer_price_pence from jobs where id=${supplierJob}`,
  ) === "DSP-100 8000",
);

await fillJob({
  source: "supplier",
  supplier: "Trip.com",
  supplierReference: "DSP-100 ",
  name: "Someone Else",
  phone: "07700 900778",
  flight: "",
  date: day(3),
});
await page.getByRole("button", { name: "Create booking" }).click();
await page.getByText(/already entered as J-/).waitFor({ timeout: 15_000 });
check("the same supplier reference is refused, naming the job that has it", true);

await page.goto(`${base}/admin/jobs/${supplierJob}`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Create return trip" }).click();
await page.waitForURL(/returnOf=/);
check(
  "the return trip reverses the route and keeps the passenger and supplier reference",
  (await page.inputValue("#pickupAddress")) === "10 Wren Avenue, Uxbridge" &&
    (await page.inputValue("#dropoffAddress")) === "Heathrow Terminal 5" &&
    (await page.inputValue("#leadName")) === "Supplier Passenger" &&
    (await page.inputValue("#supplierReference")) === "DSP-100",
);
await page.fill("#pickupDate", day(5));
await page.fill("#pickupTime", "18:30");
await page.fill("#price", "80");
await page.getByRole("button", { name: "Create return trip" }).click();
await page.waitForURL(/notice=created/, { timeout: 20_000 });
const returnJob = Number(page.url().match(/jobs\/(\d+)/)[1]);
body = await text(page);
check(
  "the return is saved with the same supplier reference, linked to the outbound",
  /Return leg/.test(body) &&
    /Outbound journey/.test(body) &&
    sql(`select leg || ' ' || return_of_job_id from jobs where id=${returnJob}`) ===
      `return ${supplierJob}`,
);

// --- Assignment ---------------------------------------------------------------------
// One search for drivers and their cars; the closest is first.
async function chooseDriver(query) {
  await page.fill("#assign-search", query);
  await page.locator('ul[aria-label="Drivers"] > li').first().locator("button").click();
}
await page.goto(`${base}/admin/jobs/${jobId}`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Assign driver" }).first().click();
await page.waitForURL(/\/assign$/);
body = await text(page);
check(
  "the assign screen lists Sam with his own car only, not the one he no longer uses",
  /Sam Taylor/.test(body) &&
    /CD34EFG/.test(body) &&
    !/AB12CDE/.test(body) &&
    /EF56GHJ/.test(body),
);
await chooseDriver("sam");
check(
  "it warns about Sam's licence running out soon",
  /PHV driver licence expires within 30 days/.test(await text(page)),
);
await page.screenshot({ path: `${shots}/dispatch-assign.png`, fullPage: true });
check(
  "with passenger emails switched off, assigning offers no email",
  (await page.locator("#notifyPassenger").count()) === 0 &&
    !/Email the passenger their driver/.test(await text(page)),
);
await page.fill("#driverPrice", "35");
await page.getByRole("button", { name: "Confirm assignment" }).click();
await page.waitForURL(/notice=assigned/, { timeout: 20_000 });
body = await text(page);
check(
  "the driver's price written when assigning is saved on the booking",
  sql(`select driver_price_pence from jobs where id=${jobId}`) === "3500" &&
    (await page.inputValue("#driverPrice")) === "35.00",
);
check(
  "after assignment the job shows the driver, PHV number, registration and dispatcher",
  /Assigned/.test(body) &&
    /Sam Taylor/.test(body) &&
    /PHV-123456/.test(body) &&
    /CD34EFG/.test(body) &&
    /Dispatched by\s*Carl Controller/.test(body),
);
check(
  "the PHV number and registration are copied onto the job",
  sql(
    `select driver_phv_no || ' ' || vehicle_reg || ' ' || dispatched_by_user_id from jobs where id=${jobId}`,
  ) ===
    `PHV-123456 CD34EFG ${sql("select id from users where email='controller@local.test'")}`,
);
check(
  "the history records who was assigned, with the vehicle",
  /Driver assigned/.test(body) && /Sam Taylor · CD34EFG/.test(body),
);

// The API refuses what the screen would not offer.
const controllerToken = await login("controller@local.test");
const refused = await api(`/api/jobs/${jobId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ driver: sam, vehicle: oldVehicle }),
});
check(
  "the API refuses Sam's old car, no longer used and its MOT expired",
  refused.status === 400 &&
    /MOT certificate has expired/.test(JSON.stringify(refused.body)),
  `status ${refused.status} ${JSON.stringify(refused.body).slice(0, 160)}`,
);
const notHis = await api(`/api/jobs/${jobId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ driver: sam, vehicle: priyaCar }),
});
check(
  "the API refuses another driver's car",
  notHis.status === 400 &&
    /That car is not this driver's own/.test(JSON.stringify(notHis.body)),
  `status ${notHis.status}`,
);
const early = await api(`/api/jobs/${jobId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "completed" }),
});
check(
  "the API refuses jumping from assigned straight to completed",
  early.status === 400 && /one stage at a time/.test(JSON.stringify(early.body)),
  `status ${early.status}`,
);
const skip = await api(`/api/jobs/${duplicateId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "assigned" }),
});
check(
  "the API refuses reopening a cancelled job",
  skip.status === 400,
  `status ${skip.status}`,
);

// WhatsApp.
const waLink = page.getByRole("link", { name: "Send job on WhatsApp" });
const href = await waLink.getAttribute("href");
const decoded = decodeURIComponent(href.split("?text=")[1] ?? "");
check(
  "Send on WhatsApp addresses the driver's number with the job written out",
  href.startsWith("https://wa.me/447700900456?text=") &&
    decoded.includes("*NEW JOB J-") &&
    decoded.includes("Pickup: Heathrow Terminal 5") &&
    decoded.includes("Flight: BA117") &&
    decoded.includes("Passenger: Dispatch Test, +447700900777") &&
    decoded.includes("*Collect in cash: £55.00*") &&
    decoded.includes("Notes: Call on landing") &&
    decoded.includes("Your price: £35.00") &&
    decoded.includes("Office: +44 7926 608888"),
);
const [popup] = await Promise.all([context.waitForEvent("page"), waLink.click()]);
await popup.close().catch(() => {});
await page.getByText("Opened in WhatsApp").first().waitFor({ timeout: 15_000 });
body = await text(page);
check(
  "opening it is recorded on the job",
  /Job message opened in WhatsApp for Sam Taylor/.test(body),
);
await page.getByRole("button", { name: "Read", exact: true }).click();
await page.waitForLoadState("networkidle");
check(
  "the controller can record what WhatsApp shows",
  sql(`select driver_message_status from jobs where id=${jobId}`) === "read",
);

// Driver confirmed.
await page.getByRole("button", { name: "Driver confirmed" }).click();
await page.waitForURL(/notice=status-driver_confirmed/, { timeout: 15_000 });
body = await text(page);
check(
  "the driver's confirmation is recorded with the time",
  /Driver confirmed/.test(body) && /Confirmed\s/.test(body),
);
check(
  "after confirmation only the next stage, DOW, is offered",
  (await page.getByRole("button", { name: "DOW — Driver on the way" }).count()) === 1 &&
    !(await page.getByRole("button", { name: /POB|Completed|PNS/ }).count()),
);
const jump = await api(`/api/jobs/${jobId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ status: "on_board" }),
});
check(
  "the API refuses jumping from confirmed to POB",
  jump.status === 400 && /one stage at a time/.test(JSON.stringify(jump.body)),
  `status ${jump.status}`,
);
await page.screenshot({ path: `${shots}/dispatch-job.png`, fullPage: true });

// Change driver to Priya: Sam comes off the job, so a reason is required.
const swapNoReason = await api(`/api/jobs/${jobId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ driver: priya, vehicle: priyaCar }),
});
check(
  "the API refuses to take a driver off a job without a reason",
  swapNoReason.status === 400 &&
    /Write why the driver is coming off this booking/.test(
      JSON.stringify(swapNoReason.body),
    ),
  `status ${swapNoReason.status}`,
);
await page.getByRole("link", { name: "Change" }).click();
await page.waitForURL(/\/assign$/);
check(
  "keeping the same driver asks for no reason",
  (await page.locator("#taken-off-reason").count()) === 0,
);
await chooseDriver("priya");
check(
  "choosing another driver asks why the current one is coming off",
  await page.getByLabel("Why is Sam Taylor coming off this booking?").isVisible(),
);
await page.fill("#taken-off-reason", "Sam's car is in for repair");
await page.getByRole("button", { name: "Confirm assignment" }).click();
await page.waitForURL(/notice=assigned/, { timeout: 20_000 });
body = await text(page);
const removedHref = await page
  .getByRole("link", { name: /job removed/ })
  .getAttribute("href");
check(
  "after a change, the previous driver can be told the job is off",
  /Tell Sam Taylor the job is no longer theirs/.test(body) &&
    decodeURIComponent(removedHref).includes("*JOB REMOVED J-"),
);
check(
  "a driver who has not agreed to WhatsApp cannot be sent the job from here",
  /Priya Shah has not agreed to receive jobs on WhatsApp/.test(body),
);
check(
  "a new driver starts unconfirmed",
  sql(
    `select status || ' ' || coalesce(driver_confirmed_at::text,'none') from jobs where id=${jobId}`,
  ) === "assigned none",
);
check(
  "the history shows the change of driver, with the reason",
  /Driver changed/.test(body) && /Reason: Sam's car is in for repair/.test(body),
);
check(
  "the history records which driver came off, and why",
  sql(
    `select driver_taken_off_id || ' ' || note from job_events where job_id=${jobId} and type='assigned' and driver_taken_off_id is not null order by id desc limit 1`,
  ) === `${sam} Sam's car is in for repair`,
);
check(
  "the passenger was not emailed: driver details emails are switched off",
  sql(`select passenger_message_status from jobs where id=${jobId}`) === "not_sent" &&
    sql(
      `select count(*) from job_events where job_id=${jobId} and field = 'passengerEmail'`,
    ) === "0",
);
check(
  "the booking's page offers no email to the passenger while it is off",
  (await page
    .getByRole("button", { name: /Email the passenger|Email them again/ })
    .count()) === 0 && !/Driver details to the passenger/.test(await text(page)),
);

// Remove the driver: again, only with a reason.
const removeNoReason = await api(`/api/jobs/${jobId}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ driver: null, vehicle: null }),
});
check(
  "…nor to remove one without a reason",
  removeNoReason.status === 400 &&
    /Write why the driver is coming off/.test(JSON.stringify(removeNoReason.body)),
  `status ${removeNoReason.status}`,
);
await page.getByRole("button", { name: "Remove driver" }).click();
await page
  .locator("dialog[open] #taken-off-reason")
  .fill("Passenger asked for a larger car");
await page.locator("dialog[open]").getByRole("button", { name: "Remove driver" }).click();
await page.waitForURL(/notice=driver-removed/, { timeout: 15_000 });
body = await text(page);
check(
  "removing the driver unassigns the job and clears the TfL fields",
  /Unassigned/.test(body) &&
    /Driver removed/.test(body) &&
    sql(
      `select coalesce(driver_phv_no,'-') || coalesce(vehicle_reg,'-') from jobs where id=${jobId}`,
    ) === "--",
);
check(
  "the removal is on the history with the driver and the reason",
  /Reason: Passenger asked for a larger car/.test(body) &&
    sql(
      `select driver_taken_off_id || ' ' || note from job_events where job_id=${jobId} and type='unassigned' order by id desc limit 1`,
    ) === `${priya} Passenger asked for a larger car`,
);

// --- A job that has happened: assign and complete ---------------------------------
const past = new Date(Date.now() - 2 * 3_600_000);
await fillJob({
  date: londonDate(past),
  time: londonTime(past),
  name: "Past Passenger",
  phone: "07700 900777",
  flight: "",
  pickup: "Gatwick South",
});
await page.getByRole("button", { name: "Create booking" }).click();
await page
  .waitForURL(/notice=created|This may already/, { timeout: 20_000 })
  .catch(() => {});
if (await page.getByRole("button", { name: /save anyway/ }).count()) {
  await page.getByRole("button", { name: /save anyway/ }).click();
  await page.waitForURL(/notice=created/, { timeout: 20_000 });
}
const pastJob = Number(page.url().match(/jobs\/(\d+)/)[1]);
await page.goto(`${base}/admin/jobs/${pastJob}/assign`, { waitUntil: "networkidle" });
await chooseDriver("sam");
await page.fill("#driverPrice", "40");
await page.getByRole("button", { name: "Confirm assignment" }).click();
await page.waitForURL(/notice=assigned/, { timeout: 20_000 });
async function stepTo(name, status) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForURL(new RegExp(`notice=status-${status}`), { timeout: 15_000 });
}
await stepTo("Driver confirmed", "driver_confirmed");
await stepTo("DOW — Driver on the way", "on_the_way");
await stepTo("DAP — Driver at pickup", "at_pickup");
check(
  "at the pickup both outcomes are offered: POB or PNS",
  (await page.getByRole("button", { name: "POB — Passenger on board" }).count()) === 1 &&
    (await page.getByRole("button", { name: "PNS — Passenger no-show" }).count()) === 1,
);
await stepTo("POB — Passenger on board", "on_board");
const swap = await api(`/api/jobs/${pastJob}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ driver: priya, vehicle: priyaCar }),
});
check(
  "once the passenger is on board the driver cannot change, here or through the API",
  !(await page.getByRole("button", { name: "Remove driver" }).count()) &&
    !(await page.getByRole("link", { name: "Change" }).count()) &&
    swap.status === 400,
  `status ${swap.status}`,
);
await stepTo("Completed", "completed");
check(
  "every stage's time is recorded on the way to Completed",
  sql(
    `select (driver_confirmed_at is not null) and (on_the_way_at is not null) and (at_pickup_at is not null) and (on_board_at is not null) and (completed_at is not null) from jobs where id=${pastJob}`,
  ) === "t",
);
await page.screenshot({ path: `${shots}/booking-progress.png`, fullPage: true });

// A completed booking is the Owner's to change (Cityline, 13 Oct 2026): the
// Controller is not offered a step back; the Owner steps it back.
check(
  "a Controller is not offered a step back once the booking is completed",
  (await page.locator(`#step-back-${pastJob}`).count()) === 0 &&
    /Completed: only the Owner can change it now/.test(await text(page)),
);
{
  const owner = await session("owner@local.test");
  await owner.page.goto(`${base}/admin/jobs/${pastJob}`, { waitUntil: "networkidle" });
  await owner.page.selectOption(`#step-back-${pastJob}`, "at_pickup");
  await owner.page.getByRole("button", { name: "Step back" }).click();
  await owner.page.waitForURL(/notice=status-at_pickup/, { timeout: 15_000 });
  body = await text(owner.page);
  await owner.context.close();
}
await page.goto(`${base}/admin/jobs/${pastJob}`, { waitUntil: "networkidle" });
check(
  "stepping back from Completed to DAP undoes the later stages and says so in the history",
  sql(
    `select status || ' ' || (on_board_at is null) || ' ' || (completed_at is null) from jobs where id=${pastJob}`,
  ) === "at_pickup true true" && /Stepped back to DAP/.test(body),
);

await page.getByRole("button", { name: "PNS — Passenger no-show" }).click();
await page.locator("dialog[open] input[name=driverPrice]").fill("15");
await page.locator("dialog[open]").getByRole("button", { name: "Mark PNS" }).click();
await page.waitForURL(/notice=status-no_show/, { timeout: 15_000 });
check(
  "a passenger no-show can cut the driver's price in the same step",
  sql(
    `select status || ' ' || driver_price_pence || ' ' || (no_show_at is not null) from jobs where id=${pastJob}`,
  ) === "no_show 1500 true",
);
check(
  "after PNS the driver's price can still be changed",
  (await page.inputValue("#driverPrice")) === "15.00",
);

// The return leg gets a driver but no price yet, for the dashboard and board.
const returnAssigned = await api(`/api/jobs/${returnJob}`, controllerToken, {
  method: "PATCH",
  body: JSON.stringify({ driver: priya, vehicle: priyaCar }),
});
check("a second booking is assigned for the board checks", returnAssigned.status === 200);

// --- The driver's price on the booking ------------------------------------------------
await page.goto(`${base}/admin/jobs/${supplierJob}`, { waitUntil: "networkidle" });
await page.fill("#driverPrice", "abc");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.getByText("Enter the driver's price in pounds").waitFor({ timeout: 10_000 });
check("a nonsense driver price is refused beside the box", true);
await page.fill("#driverPrice", "38.50");
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForURL(/notice=driver-price/, { timeout: 15_000 });
body = await text(page);
check(
  "the driver's price is saved and recorded in the booking's history",
  sql(`select driver_price_pence from jobs where id=${supplierJob}`) === "3850" &&
    /Changed driver price/.test(body) &&
    /£38\.50/.test(body),
);

// --- The bookings dashboard -------------------------------------------------------------
await page.goto(`${base}/admin/bookings?when=week`, { waitUntil: "networkidle" });
body = await text(page);
check(
  "the bookings dashboard lists bookings with client, service, driver and both prices",
  /Dispatch Test/.test(body) &&
    /Supplier Passenger/.test(body) &&
    /Trip\.com/.test(body) &&
    /From airport/.test(body) &&
    /£80\.00/.test(body) &&
    /£38\.50/.test(body),
);
check(
  "the menu says Bookings, not Jobs",
  (await page.getByRole("link", { name: "Bookings", exact: true }).count()) > 0 &&
    (await page.getByRole("link", { name: "Jobs", exact: true }).count()) === 0,
);
await page.screenshot({ path: `${shots}/bookings-dashboard.png`, fullPage: true });
await page.goto(`${base}/admin/bookings?when=all&q=dsp-100`, {
  waitUntil: "networkidle",
});
body = await text(page);
check(
  "searching a supplier's reference finds both legs",
  (body.match(/Supplier Passenger/g) ?? []).length >= 2 && !/Dispatch Test/.test(body),
);
await page
  .locator("tbody tr")
  .filter({ hasText: "Supplier Passenger" })
  .first()
  .locator("td")
  .nth(4)
  .click();
await page.waitForURL(/\/admin\/jobs\/\d+$/, { timeout: 15_000 });
check("clicking a row opens the booking", /Driver and dispatch/.test(await text(page)));
await page.goto(`${base}/admin/bookings?when=all&status=unassigned&test=1`, {
  waitUntil: "networkidle",
});
check(
  "filtering by status shows only that status",
  (await page.locator("tbody").getByText("Assigned", { exact: true }).count()) === 0 &&
    (await page.locator("tbody").getByText("Unassigned", { exact: true }).count()) > 0,
);
await page.goto(`${base}/admin/bookings?when=all&noDriverPrice=1`, {
  waitUntil: "networkidle",
});
body = await text(page);
check(
  "the dashboard finds assigned bookings with no driver price",
  /Supplier Passenger/.test(body) &&
    !/Past Passenger/.test(body) &&
    !/Dispatch Test/.test(body),
);

// Pickup dates sit with the other filters, and choosing one sets "All dates".
await page.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
check(
  "the Pickup list has no 'Pickup dates' option",
  !(await page.locator("#bookings-when option", { hasText: "Pickup dates" }).count()),
);
await page.fill("#bookings-from", day(4));
await page.waitForURL(/from=/, { timeout: 15_000 });
await page.waitForLoadState("networkidle");
body = await text(page);
check(
  "a pickup date filters by date and sets the list to All dates",
  (await page.inputValue("#bookings-when")) === "all" &&
    /Supplier Passenger/.test(body) &&
    !/Dispatch Test/.test(body),
);
await page.selectOption("#bookings-when", "today");
await page.waitForURL((url) => !url.search.includes("from="), { timeout: 15_000 });
check(
  "choosing a preset clears the dates",
  (await page.inputValue("#bookings-from")) === "",
);

// Moving a booking on from the dashboard keeps the operator on the dashboard.
await page.goto(`${base}/admin/bookings?when=all&q=dsp-100`, {
  waitUntil: "networkidle",
});
await page
  .locator("tbody tr")
  .filter({ hasText: "Priya Shah" })
  .getByRole("button", { name: "Confirmed" })
  .click();
// The row redraws with the next stage's button once the change is saved.
await page
  .locator("tbody tr")
  .filter({ hasText: "Priya Shah" })
  .getByRole("button", { name: "DOW" })
  .waitFor({ timeout: 15_000 });
check(
  "the dashboard moves a booking on one stage and stays put",
  /\/admin\/bookings\?/.test(page.url()) &&
    sql(`select status from jobs where id=${returnJob}`) === "driver_confirmed",
);
await page.goto(`${base}/admin/jobs?unassigned=1`, { waitUntil: "networkidle" });
check(
  "the old jobs address leads to the dashboard with its filter",
  /\/admin\/bookings\?status=unassigned/.test(page.url()),
);

// --- No Dispatch board: Bookings has it all ------------------------------------------
check(
  "the menu has no Dispatch, and Bookings no Dispatch board button",
  (await page.locator('a[href^="/admin/dispatch"]').count()) === 0 &&
    !(await page.getByRole("link", { name: "Dispatch board" }).count()),
);
await page.goto(`${base}/admin/dispatch?range=week`, { waitUntil: "networkidle" });
check(
  "the old Dispatch address leads to Bookings",
  new URL(page.url()).pathname === "/admin/bookings",
  page.url(),
);
await page.goto(`${base}/admin/dispatch?unassigned=1`, { waitUntil: "networkidle" });
check(
  "…with 'need a driver' kept as the unassigned filter",
  /\/admin\/bookings\?status=unassigned/.test(page.url()),
  page.url(),
);
await page.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
const needHref = await page
  .locator("a", { hasText: "Need a driver (24 h)" })
  .first()
  .getAttribute("href");
check(
  "'Need a driver' opens Bookings filtered to unassigned",
  needHref === "/admin/bookings?status=unassigned",
  String(needHref),
);

// --- Website job: operational details only --------------------------------------------
const websiteJob = Number(
  sql(
    "select j.id from jobs j join bookings b on b.id = j.booking_id where j.source='website' and j.status in ('unassigned','assigned','driver_confirmed','on_the_way','at_pickup') and b.status = 'confirmed' order by j.id desc limit 1",
  ) || 0,
);
if (websiteJob) {
  await page.goto(`${base}/admin/jobs/${websiteJob}/edit`, { waitUntil: "networkidle" });
  body = await text(page);
  check(
    "a website job's edit form shows price, customer and route as locked",
    /Price, customer and route are locked/.test(body) &&
      !(await page.locator("#pickupAddress").count()) &&
      !(await page.locator("#price").count()),
  );
  await page.fill("#flightNumber", "EK1");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL(/notice=saved/, { timeout: 15_000 });
  check(
    "…and its flight can be changed, recorded in its history",
    /Changed flight/.test(await text(page)),
  );
  // A website booking is cancelled whole (Cancel booking), never one leg alone.
  await page.goto(`${base}/admin/jobs/${websiteJob}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Cancel booking" }).click();
  const cancelDialog = (await page.locator("dialog[open]").innerText()).replace(
    /\s+/g,
    " ",
  );
  check(
    "a website booking offers Cancel booking for the whole order, listing its journeys",
    /The whole booking is cancelled/.test(cancelDialog) &&
      cancelDialog.includes(sql(`select reference from jobs where id=${websiteJob}`)),
    cancelDialog.slice(0, 200),
  );
  await page.locator("dialog[open]").getByRole("button", { name: "Close" }).click();
  const oneLeg = await api(`/api/jobs/${websiteJob}`, controllerToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", cancelReason: "Check" }),
  });
  check(
    "the server refuses cancelling one leg of a website booking",
    oneLeg.status === 400 &&
      /cancelled as a whole/.test(JSON.stringify(oneLeg.body)) &&
      sql(`select status from jobs where id=${websiteJob}`) !== "cancelled",
    `status ${oneLeg.status}`,
  );
  // Payment links and the website lock are the system's alone.
  const linksBefore = sql(
    `select locked || ':' || coalesce(driver_payment_id::text, '-') || ':' || coalesce(customer_paid_price_pence::text, '-') from jobs where id=${websiteJob}`,
  );
  await api(`/api/jobs/${websiteJob}`, controllerToken, {
    method: "PATCH",
    body: JSON.stringify({ locked: false, driverPayment: 1, customerPaidPricePence: 1 }),
  });
  check(
    "staff cannot unlock a website booking or change its payment links, even through the API",
    sql(
      `select locked || ':' || coalesce(driver_payment_id::text, '-') || ':' || coalesce(customer_paid_price_pence::text, '-') from jobs where id=${websiteJob}`,
    ) === linksBefore && linksBefore.startsWith("true"),
    linksBefore,
  );
} else {
  check("a website job exists to test", false, "none in the local database");
}
await context.close();

// --- Other roles ------------------------------------------------------------------------
{
  const { page: ap, context: ac } = await session("accounts@local.test");
  await ap.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
  check(
    "no Dispatch in the menu for accounts either",
    (await ap.locator('a[href^="/admin/dispatch"]').count()) === 0,
  );
  await ap.goto(`${base}/admin/jobs/${supplierJob}`, { waitUntil: "networkidle" });
  body = await text(ap);
  check(
    "accounts see the booking's profit after the driver's price, and no commission",
    /Driver price/.test(body) &&
      /£41\.50/.test(body) &&
      !/commission/i.test(body) &&
      !(await ap.locator("#driverPrice").count()) &&
      !(await ap.getByRole("link", { name: "Assign driver" }).count()) &&
      !(await ap.getByRole("link", { name: "Edit" }).count()),
  );
  await ap.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  check(
    "accounts cannot add jobs",
    /You do not have access to this/.test(await text(ap)),
  );
  await ac.close();
}

// --- Phones -------------------------------------------------------------------------------
{
  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  for (const path of [
    "/admin/bookings?when=week",
    "/admin/bookings?status=unassigned",
    `/admin/jobs/${jobId}`,
    `/admin/jobs/${jobId}/assign`,
    "/admin/jobs/new",
  ]) {
    await mp.goto(base + path, { waitUntil: "networkidle" });
    const overflow = await mp.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`${path} fits a phone`, overflow <= 0, `overflow ${overflow}px`);
  }
  await mc.close();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
