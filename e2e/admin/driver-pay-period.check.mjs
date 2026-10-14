import "./local-only.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

/**
 * The period a driver payment covers (Cityline, 14 Oct 2026): from the day
 * after the driver's last payment to the day it runs up to, whatever days
 * they worked in between. Paid up to the 4th, then up to the 13th, the second
 * covers the 5th to the 13th. A booking paid late reaches the start back.
 * Shown on the pay form, the payments table, the driver's page, the WhatsApp
 * note, the statement and the CSV. Everything it adds is removed at the end.
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
function londonIso(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  })
    .formatToParts(guess)
    .find((part) => part.type === "timeZoneName").value;
  return new Date(
    guess.getTime() - Number(offset.replace("GMT", "") || 0) * 3_600_000,
  ).toISOString();
}
/** As the app writes a period: "5 Oct – 13 Oct 2026", one day "13 Oct 2026". */
function period(from, to) {
  const noon = (d) => new Date(`${d}T12:00:00Z`);
  const format = (d, year) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
    }).format(noon(d));
  if (from === to) return format(to, true);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${format(from, false)} – ${format(to, true)}`
    : `${format(from, true)} – ${format(to, true)}`;
}
const pdfText = (bytes) => {
  const file = `${shots}/period-statement.tmp.pdf`;
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
const PHONE = "+447700900663";
const fixtureJobs = `select id from jobs where lead_phone = '${PHONE}'`;
function cleanUp() {
  sql(
    `delete from driver_payments where id in (select _parent_id from driver_payments_lines where job_id in (${fixtureJobs}))`,
  );
  sql(`delete from job_events where job_id in (${fixtureJobs})`);
  sql(`delete from jobs where lead_phone = '${PHONE}'`);
}
cleanUp();

const priya = Number(sql("select id from drivers where phone = '+447700900458'"));
const vehicle = Number(sql("select id from vehicles where registration = 'CD34EFG'"));
const controllerToken = await login("controller@local.test");
let serial = 0;
async function done(date, time, price) {
  serial += 1;
  const created = await api("/api/jobs", controllerToken, {
    method: "POST",
    body: JSON.stringify({
      reference: `J-Q${Date.now().toString().slice(-5)}${serial}`,
      source: "phone",
      status: "unassigned",
      pickupAt: londonIso(date, time),
      pickupAddress: "Heathrow Terminal 5",
      dropoffAddress: "10 Wren Avenue, Uxbridge UB8 1AA",
      vehicleClassSlug: "saloon",
      passengers: 1,
      largeBags: 1,
      smallBags: 0,
      leadName: "Period Check Passenger",
      leadPhone: PHONE,
      customerPricePence: 6000,
      paymentMethod: "card_link",
    }),
  });
  const id = created.body?.doc?.id;
  sql(
    `update jobs set driver_id = ${priya}, vehicle_id = ${vehicle}, vehicle_reg = 'CD34EFG', status = 'completed', driver_price_pence = ${price} where id = ${id}`,
  );
  return { id, reference: created.body?.doc?.reference };
}

const first = { upTo: day(-10) };
const second = { upTo: day(-1) };
const J1 = await done(day(-12), "10:00", 2500);
const J2 = await done(day(-7), "09:00", 3000);
const J3 = await done(day(-6), "14:00", 3500);
check(
  "the fixture bookings are set up",
  [J1, J2, J3].every((job) => job.id),
);

// Priya's own last payment before these, if the local data has one.
const before = sql(
  `select to_char(max(up_to at time zone 'Europe/London'), 'YYYY-MM-DD') from driver_payments where driver_id = ${priya} and voided_at is null and (up_to at time zone 'Europe/London')::date < '${first.upTo}'`,
);
const nextDay = (d) => {
  const date = new Date(`${d}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
first.from = before ? [nextDay(before), day(-12)].sort()[0] : day(-12);
second.from = nextDay(first.upTo);

const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.request.post(`${base}/api/users/login`, {
  data: { email: "accounts@local.test", password: PASSWORD },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
const body = async () => (await page.locator("main").innerText()).replace(/\s+/g, " ");

async function pay(upTo, jobs, amount) {
  await page.goto(`${base}/admin/driver-pay/${priya}?upTo=${upTo}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByRole("button", { name: "Untick all" }).click();
  for (const job of jobs) await page.check(`#pay-${job.id}`);
  const preview = await body();
  await page.getByRole("button", { name: `Record payment of ${amount}` }).click();
  await page.waitForURL(/notice=paid/, { timeout: 30_000 });
  return { preview, id: Number(new URL(page.url()).searchParams.get("payment")) };
}

try {
  // --- First payment: up to the 10th day ago ----------------------------------------
  const p1 = await pay(first.upTo, [J1], "£25.00");
  check(
    "the pay form shows the period before it is recorded",
    p1.preview.includes(`Covers ${period(first.from, first.upTo)}`),
    period(first.from, first.upTo),
  );

  // --- Second payment: from the day after, whatever days were worked ----------------
  const p2 = await pay(second.upTo, [J2, J3], "£65.00");
  const expected = period(second.from, second.upTo);
  check(
    "the next payment covers the day after the last one to its own day",
    p2.preview.includes(`Covers ${expected}`) &&
      sql(
        `select to_char(period_from at time zone 'Europe/London', 'YYYY-MM-DD') from driver_payments where id = ${p2.id}`,
      ) === second.from,
    expected,
  );
  const driverPage = await body();
  check(
    "the driver's payment list shows each period",
    driverPage.includes(`2 bookings, ${expected}`) &&
      driverPage.includes(`1 booking, ${period(first.from, first.upTo)}`),
  );
  const href = await page
    .getByRole("link", { name: "Send statement on WhatsApp" })
    .getAttribute("href")
    .catch(() => null);
  const note = href ? decodeURIComponent(href.split("text=")[1] ?? "") : "";
  check(
    "the WhatsApp note gives the period",
    !href || note.includes(`2 bookings, ${expected}: £65.00`),
    href ? "" : "Priya has no WhatsApp consent locally: not offered",
  );

  const pdf = await page.evaluate(async (id) => {
    const response = await fetch(`/api/driver-pay/${id}/statement`);
    return [...new Uint8Array(await response.arrayBuffer())];
  }, p2.id);
  const statement = pdfText(pdf).replace(/\s+/g, " ");
  check(
    "the statement's COVERS gives the period, not 'up to'",
    statement.includes(expected) && !/up to \d/.test(statement),
    statement.slice(statement.indexOf("COVERS"), statement.indexOf("COVERS") + 80),
  );

  await page.goto(`${base}/admin/driver-pay?period=last_30`, {
    waitUntil: "networkidle",
  });
  const table = await body();
  check(
    "the payments table has a Covers column",
    /Covers/.test(table) && table.includes(expected),
  );
  const csv = await page.evaluate(async () => {
    const response = await fetch("/api/reports/driver-payments?period=last_30");
    return response.text();
  });
  check(
    "the CSV gives where each payment's period starts and ends",
    /Covers from,Covers to/.test(csv) && csv.includes(`${second.from},${second.upTo}`),
  );

  // --- A booking paid late reaches the start back -------------------------------------
  const late = await done(day(-13), "16:00", 1000);
  const p3 = await pay(day(0), [late], "£10.00");
  check(
    "a booking older than the last payment moves the start back to its day",
    p3.preview.includes(`Covers ${period(day(-13), day(0))}`),
    period(day(-13), day(0)),
  );
} finally {
  cleanUp();
}

check("no JavaScript errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
