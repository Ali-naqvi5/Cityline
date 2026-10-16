import "./local-only.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

/**
 * Subcontracting operators (Cityline, 15 Oct 2026), end to end: adding one,
 * giving a booking to them from the assign page, refusing one whose licence
 * has run out, the same stages to Completed, the bookings filter, and paying
 * them in Driver Pay with their statement. Everything it adds is removed.
 */

const base = "http://localhost:3000";
const shots = "test-results/admin";
const PASSWORD = process.env.ADMIN_TEST_PASSWORD;
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
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
const pdfText = (bytes) => {
  const file = `${shots}/operator-statement.tmp.pdf`;
  writeFileSync(file, Buffer.from(bytes));
  return execFileSync(
    "python",
    [
      "-c",
      `from pypdf import PdfReader; print("\\n".join(p.extract_text() for p in PdfReader(r"${file}").pages))`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: `${shots}/pylib`, PYTHONIOENCODING: "utf-8" },
    },
  );
};
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

// --- Fixtures (local database only) --------------------------------------------------
const PHONE = "+447700900664";
const NAME = "Check Operator";
const fixtureJobs = `select id from jobs where lead_phone = '${PHONE}'`;
function cleanUp() {
  sql(
    `delete from driver_payments where id in (select _parent_id from driver_payments_lines where job_id in (${fixtureJobs}))`,
  );
  sql(`delete from job_events where job_id in (${fixtureJobs})`);
  sql(`delete from jobs where lead_phone = '${PHONE}'`);
  sql(`delete from operators where name like '${NAME}%'`);
}
cleanUp();

const controllerToken = await login("controller@local.test");
// A booking picked up two hours ago, so its stages can run to Completed.
const pickup = new Date(Date.now() - 2 * 3_600_000).toISOString();
const created = await api("/api/jobs", controllerToken, {
  method: "POST",
  body: JSON.stringify({
    reference: `J-O${Date.now().toString().slice(-6)}`,
    source: "phone",
    status: "unassigned",
    pickupAt: pickup,
    pickupAddress: "Heathrow Terminal 5",
    dropoffAddress: "10 Wren Avenue, Uxbridge UB8 1AA",
    vehicleClassSlug: "saloon",
    passengers: 1,
    largeBags: 1,
    smallBags: 0,
    leadName: "Operator Check Passenger",
    leadPhone: PHONE,
    customerPricePence: 6000,
    paymentMethod: "card_link",
  }),
});
const job = { id: created.body?.doc?.id, reference: created.body?.doc?.reference };
check("the fixture booking is set up", Boolean(job.id), `status ${created.status}`);

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
const main = async (page) =>
  (await page.locator("main").innerText()).replace(/\s+/g, " ");

try {
  const { page, context } = await session("controller@local.test");

  // --- Adding operators -----------------------------------------------------------
  await page.goto(`${base}/admin/operators/new`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByRole("button", { name: "Add operator" }).click();
  await page
    .getByText("Enter a contact phone number")
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  let text = await main(page);
  check(
    "only the name, who licensed them and a phone are required",
    /Enter the operator's name/.test(text) && /Enter a contact phone number/.test(text),
  );
  await page.fill("#name", `${NAME} North`);
  await page.selectOption("#licensedFrom", "council");
  await page.fill("#phone", "020 7946 0000");
  await page.getByRole("button", { name: "Add operator" }).click();
  await page
    .getByText("Enter the council or authority that licensed them")
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  check(
    "a council licence asks which council",
    /Enter the council or authority that licensed them/.test(await main(page)),
  );
  await page.fill("#licensingAuthority", "Slough Borough Council");
  await page.fill("#licenceNumber", "op-123");
  await page.fill("#licenceExpiresAt", day(365));
  await page.fill("#contactName", "Nadia North");
  await page.check("#whatsappConsent");
  await page.getByRole("button", { name: "Add operator" }).click();
  await page.waitForURL(/\/admin\/operators\/\d+\?notice=created/, { timeout: 30_000 });
  const north = Number(page.url().match(/operators\/(\d+)/)[1]);
  text = await main(page);
  check(
    "the operator is added, active, with their licence",
    /Operator added/.test(text) &&
      /Active/.test(text) &&
      /Slough Borough Council/.test(text) &&
      /OP-123/.test(text) &&
      sql(`select phone from operators where id = ${north}`) === "+442079460000",
  );
  await page.screenshot({ path: `${shots}/operator.png`, fullPage: true });

  await page.goto(`${base}/admin/operators/new`, { waitUntil: "networkidle" });
  await page.fill("#name", `${NAME} Expired`);
  await page.fill("#phone", "07700 900665");
  await page.fill("#licenceNumber", "OLD-1");
  await page.fill("#licenceExpiresAt", day(-3));
  await page.getByRole("button", { name: "Add operator" }).click();
  await page.waitForURL(/\/admin\/operators\/\d+\?notice=created/, { timeout: 30_000 });
  const expired = Number(page.url().match(/operators\/(\d+)/)[1]);
  check(
    "an operator whose licence has run out shows it",
    /Licence expired/.test(await main(page)),
  );

  await page.goto(`${base}/admin/operators`, { waitUntil: "networkidle" });
  text = await main(page);
  check(
    "the list shows both, under Fleet",
    text.includes(`${NAME} North`) &&
      text.includes(`${NAME} Expired`) &&
      (await page.getByRole("link", { name: "Subcontracting Operators" }).count()) > 0,
  );

  // --- Giving the booking to an operator --------------------------------------------
  await page.goto(`${base}/admin/jobs/${job.id}/assign`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Assign to an operator" }).click();
  await page.waitForURL(/to=operator/);
  await page.waitForLoadState("networkidle");
  text = await main(page);
  check(
    "the assign page lists the operators; the expired one cannot take it",
    text.includes(`${NAME} North`) &&
      /Cannot take it/.test(text) &&
      /Operator licence expired/.test(text),
  );
  await page.getByRole("button", { name: new RegExp(`${NAME} North`) }).click();
  await page.fill("#driverPrice", "40");
  await page.getByRole("button", { name: "Assign to operator" }).click();
  await page.waitForURL(/notice=assigned-operator/, { timeout: 30_000 });
  text = await main(page);
  check(
    "the booking is the operator's: their name and licence on its record",
    /Given to the operator/.test(text) &&
      /Subcontracted to/.test(text) &&
      text.includes(`${NAME} North`) &&
      /Slough Borough Council/.test(text) &&
      /OP-123/.test(text) &&
      sql(
        `select status || '|' || coalesce(driver_id::text,'none') || '|' || operator_id || '|' || subcontractor_name || '|' || subcontractor_licence_no || '|' || driver_price_pence from jobs where id = ${job.id}`,
      ) === `assigned|none|${north}|${NAME} North|OP-123|4000`,
  );
  check(
    "the job can be sent to the operator on WhatsApp",
    /Operator's WhatsApp message/.test(text) &&
      (await page.getByRole("link", { name: "Send job on WhatsApp" }).count()) === 1,
  );
  await page.screenshot({ path: `${shots}/operator-booking.png`, fullPage: true });

  // The server refuses what the screen would not offer.
  let res = await api(`/api/jobs/${job.id}`, controllerToken, {
    method: "PATCH",
    body: JSON.stringify({ operator: expired, takenOffReason: "check" }),
  });
  check(
    "an operator whose licence has run out cannot be given a booking",
    res.status === 400 && /cannot take this booking/.test(JSON.stringify(res.body)),
    `status ${res.status}`,
  );
  const someDriver = Number(
    sql("select id from drivers where status = 'active' order by id limit 1"),
  );
  const someCar = Number(
    sql(
      `select v.id from vehicles v join vehicles_rels r on r.parent_id = v.id where r.drivers_id = ${someDriver} limit 1`,
    ) || 0,
  );
  res = await api(`/api/jobs/${job.id}`, controllerToken, {
    method: "PATCH",
    body: JSON.stringify({ driver: someDriver, vehicle: someCar, operator: north }),
  });
  check(
    "a booking never has a driver and an operator both",
    res.status === 400 && /not both/.test(JSON.stringify(res.body)),
    `status ${res.status}`,
  );

  // --- The same stages, to Completed: the first two pressed on the screens -------------
  const statusNow = () => sql(`select status from jobs where id = ${job.id}`);
  const waitForStatus = async (wanted) => {
    for (let i = 0; i < 60 && statusNow() !== wanted; i++) await page.waitForTimeout(500);
    return statusNow() === wanted;
  };
  await page.goto(`${base}/admin/jobs/${job.id}`, { waitUntil: "networkidle" });
  const confirm = page.getByRole("button", { name: /confirmed/i });
  check(
    "the booking page offers the operator's booking its next stage",
    (await confirm.count()) === 1 &&
      !(await main(page)).includes("The cycle starts once"),
  );
  await confirm.click();
  check(
    "pressing it moves the booking on: Confirmed",
    await waitForStatus("driver_confirmed"),
  );
  await page.goto(`${base}/admin/bookings?when=all&driver=op-${north}`, {
    waitUntil: "networkidle",
  });
  const listed = page.locator("tr", { hasText: job.reference });
  await listed.getByRole("button", { name: "DOW" }).click();
  check("the bookings list moves it on too: DOW", await waitForStatus("on_the_way"));
  const stages = ["at_pickup", "on_board", "completed"];
  const results = [];
  for (const status of stages) {
    const step = await api(`/api/jobs/${job.id}`, controllerToken, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    results.push(`${status}:${step.status}`);
  }
  check(
    "the operator's booking runs the same stages to Completed",
    results.every((r) => r.endsWith(":200")) &&
      sql(`select status from jobs where id = ${job.id}`) === "completed",
    results.join(" "),
  );

  await page.goto(`${base}/admin/bookings?when=all&driver=op-${north}`, {
    waitUntil: "networkidle",
  });
  text = await main(page);
  check(
    "the bookings filter finds the operator's bookings",
    text.includes(job.reference) && /Operator/.test(text),
  );
  await context.close();

  // --- Paying the operator in Driver Pay -------------------------------------------------
  const accounts = await session("accounts@local.test");
  await accounts.page.goto(`${base}/admin/driver-pay`, { waitUntil: "networkidle" });
  text = await main(accounts.page);
  check(
    "Driver Pay lists the operator as owed, marked as an operator",
    text.includes(`${NAME} North`) && /Operator/.test(text),
  );
  await accounts.page.goto(`${base}/admin/driver-pay/operators/${north}`, {
    waitUntil: "networkidle",
  });
  await accounts.page.getByRole("button", { name: "Untick all" }).click();
  await accounts.page.check(`#pay-${job.id}`);
  await accounts.page.getByRole("button", { name: "Record payment of £40.00" }).click();
  await accounts.page.waitForURL(/notice=paid/, { timeout: 30_000 });
  const paymentId = Number(new URL(accounts.page.url()).searchParams.get("payment"));
  check(
    "the operator is paid like a driver",
    sql(
      `select coalesce(driver_id::text,'none') || '|' || operator_id || '|' || amount_pence from driver_payments where id = ${paymentId}`,
    ) === `none|${north}|4000` &&
      sql(`select driver_payment_id from jobs where id = ${job.id}`) ===
        String(paymentId),
  );
  const pdf = await accounts.page.evaluate(async (id) => {
    const response = await fetch(`/api/driver-pay/${id}/statement`);
    return [...new Uint8Array(await response.arrayBuffer())];
  }, paymentId);
  const statement = pdfText(pdf).replace(/\s+/g, " ");
  check(
    "the statement is to the operator, with their licence",
    statement.includes(`${NAME} North`) &&
      /Operator licence OP-123\s*Slough Borough Council/.test(statement) &&
      /NET PAYMENT TO DRIVER £40\.00/.test(statement),
    statement.slice(statement.indexOf("PAID TO"), statement.indexOf("PAID TO") + 90),
  );
  await accounts.context.close();
} finally {
  cleanUp();
}

check("no JavaScript errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
