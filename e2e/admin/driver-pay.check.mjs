import "./local-only.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";
import sharp from "sharp";

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
/** The text of a PDF, read with pypdf. */
function pdfText(bytes) {
  const file = `${shots}/statement.tmp.pdf`;
  writeFileSync(file, Buffer.from(bytes));
  return execFileSync(
    "python",
    [
      "-c",
      // Pages apart with a form feed, so the last one can be told apart.
      `from pypdf import PdfReader; print("\\f".join(p.extract_text() for p in PdfReader(r"${file}").pages))`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: `${shots}/pylib`, PYTHONIOENCODING: "utf-8" },
    },
  );
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

// --- Fixtures (local database only) -----------------------------------------------
const PAY_PHONE = "+447700900662";
const fixtureJobs = `select id from jobs where lead_phone = '${PAY_PHONE}'`;
const fixtureReceipts = `select receipt_id from driver_payments where id in (select _parent_id from driver_payments_lines where job_id in (${fixtureJobs}))`;
sql(`delete from private_files where id in (${fixtureReceipts})`);
sql(
  `delete from driver_payments where id in (select _parent_id from driver_payments_lines where job_id in (${fixtureJobs}))`,
);
sql(`delete from job_events where job_id in (${fixtureJobs})`);
sql(`delete from jobs where lead_phone = '${PAY_PHONE}'`);

const sam = Number(sql("select id from drivers where phone = '+447700900456'"));
const priya = Number(sql("select id from drivers where phone = '+447700900458'"));
const vehicle = Number(sql("select id from vehicles where registration = 'CD34EFG'"));
const controllerToken = await login("controller@local.test");
const accountsToken = await login("accounts@local.test");
let serial = 0;
async function done(
  date,
  time,
  {
    driver,
    status = "completed",
    price,
    method = "card_link",
    fare = 6000,
    test = false,
  },
) {
  serial += 1;
  const created = await api("/api/jobs", controllerToken, {
    method: "POST",
    body: JSON.stringify({
      reference: `J-P${Date.now().toString().slice(-5)}${serial}`,
      source: "phone",
      status: "unassigned",
      pickupAt: londonIso(date, time),
      pickupAddress: "Heathrow Terminal 5",
      dropoffAddress: "10 Wren Avenue, Uxbridge UB8 1AA",
      vehicleClassSlug: "saloon",
      passengers: 1,
      largeBags: 1,
      smallBags: 0,
      leadName: "Pay Check Passenger",
      leadPhone: PAY_PHONE,
      customerPricePence: fare,
      paymentMethod: method,
      isTest: test,
    }),
  });
  const id = created.body?.doc?.id;
  sql(
    `update jobs set driver_id = ${driver}, vehicle_id = ${vehicle}, vehicle_reg = 'CD34EFG', status = '${status}', driver_price_pence = ${price ?? "null"} where id = ${id}`,
  );
  return { id, reference: created.body?.doc?.reference };
}
const yesterday = day(-1);
const A = await done(yesterday, "09:00", { driver: sam, price: 3500 });
const B = await done(yesterday, "12:00", {
  driver: sam,
  price: 3000,
  method: "cash",
  fare: 5000,
});
const C = await done(yesterday, "15:00", {
  driver: sam,
  status: "no_show",
  price: 1500,
  method: "cash",
});
const D = await done(yesterday, "18:00", { driver: sam, price: null });
const E = await done(day(-3), "10:00", { driver: sam, price: 2000 });
const F = await done(yesterday, "10:00", { driver: priya, price: 4000 });
const T = await done(yesterday, "11:00", { driver: sam, price: 9999, test: true });
check(
  "the fixture bookings are set up",
  [A, B, C, D, E, F, T].every((job) => job.id),
);

// --- Bank details: the owner saves them, Accounts can see them ---------------------
{
  const { page: op, context: oc } = await session("owner@local.test");
  await op.goto(`${base}/admin/drivers/${sam}`, { waitUntil: "networkidle" });
  await op.fill("#accountName", "S TAYLOR");
  await op.fill("#sortCode", "12-34-56");
  await op.fill("#accountNumber", "12345678");
  await op.getByRole("button", { name: /(Save|Replace) bank details/ }).click();
  await op.waitForURL(/notice=bank-saved/, { timeout: 15_000 });
  check("the owner saves Sam's bank details", /bank-saved/.test(op.url()));
  await oc.close();
}

// --- The overview, as Accounts -----------------------------------------------------
const { page, context } = await session("accounts@local.test");
await page.goto(`${base}/admin/driver-pay`, { waitUntil: "networkidle" });
let body = await text(page);
const owedSql = (driver, before) =>
  Number(
    sql(
      `select coalesce(sum(driver_price_pence), 0) - coalesce(sum(case when status = 'completed' and payment_method = 'cash' then customer_price_pence else 0 end), 0) from jobs where driver_id = ${driver} and status in ('completed','no_show') and driver_payment_id is null and is_test = false and driver_price_pence is not null and (pickup_at at time zone 'Europe/London')::date <= '${before}'`,
    ),
  );
const samOwed = owedSql(sam, day(0));
const pounds = (pence) =>
  `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
const samRow = await page.locator("tr", { hasText: "Sam Taylor" }).first().innerText();
check(
  "Sam's row shows what he is owed, cash taken off, test bookings left out",
  samRow.includes(pounds(samOwed)) && /without a price/.test(samRow),
  `${samRow.replace(/\s+/g, " ")} — expected ${pounds(samOwed)}`,
);
check("there is a row for each driver owed", /Priya Shah/.test(body));
await page.screenshot({ path: `${shots}/driver-pay.png`, fullPage: true });

// --- Sam's page --------------------------------------------------------------------
await page
  .locator("tr", { hasText: "Sam Taylor" })
  .getByRole("link", { name: "Review and pay" })
  .click();
await page.waitForURL(/\/admin\/driver-pay\/\d+/, { timeout: 15_000 });
await page.waitForLoadState("networkidle");
body = await text(page);
check(
  "Accounts sees where to send the money",
  /S TAYLOR/.test(body) && /12-34-56/.test(body) && /12345678/.test(body),
);
check(
  "a done booking with no driver price is listed apart, and cannot be ticked",
  /Done, no driver price yet/.test(body) &&
    body.includes(D.reference) &&
    (await page.locator(`#pay-${D.id}`).count()) === 0,
);
check("a test booking is never offered", !body.includes(T.reference));

// Pay A, B and C only.
await page.getByRole("button", { name: "Untick all" }).click();
for (const job of [A, B, C]) await page.check(`#pay-${job.id}`);
body = await text(page);
check(
  "the totals follow the ticks: prices less the cash Sam collected",
  /Driver prices\s*£80\.00/.test(body) &&
    /Less cash Sam collected\s*-£50\.00/.test(body) &&
    /To pay\s*£30\.00/.test(body),
);
await page.fill("#reference", "CITYLINE TEST");
const offered = [await page.locator("#receipt").count()];
await page.selectOption("#method", "cash");
offered.push(await page.locator("#receipt").count());
await page.selectOption("#method", "bank_transfer");
offered.push(await page.locator("#receipt").count());
check(
  "a bank transfer offers an optional receipt; cash does not",
  offered.join() === "1,0,1",
  offered.join(),
);
await page.setInputFiles("#receipt", {
  name: "transfer.png",
  mimeType: "image/png",
  buffer: await sharp({
    create: { width: 500, height: 900, channels: 3, background: "#e8f5ec" },
  })
    .png()
    .toBuffer(),
});
await page.getByRole("button", { name: "Record payment of £30.00" }).click();
await page.waitForURL(/notice=paid/, { timeout: 20_000 });
body = await text(page);
const paymentId = Number(new URL(page.url()).searchParams.get("payment"));
check(
  "the payment is recorded from the bookings themselves",
  /recorded: £30\.00/.test(body) &&
    sql(
      `select earned_pence || ' ' || cash_pence || ' ' || amount_pence || ' ' || method from driver_payments where id = ${paymentId}`,
    ) === "8000 5000 3000 bank_transfer" &&
    sql(`select count(*) from jobs where driver_payment_id = ${paymentId}`) === "3",
);
check(
  "the receipt is kept as a private file on the payment",
  sql(
    `select f.purpose from driver_payments p join private_files f on f.id = p.receipt_id where p.id = ${paymentId}`,
  ) === "receipt",
);
const receiptHref = await page
  .getByRole("link", { name: "Receipt", exact: true })
  .first()
  .getAttribute("href");
const receiptFile = await page.evaluate(async (href) => {
  const response = await fetch(href);
  return { status: response.status, type: response.headers.get("content-type") };
}, receiptHref);
check(
  "the payment shows its receipt, which opens for staff",
  receiptFile.status === 200 && /^image\//.test(receiptFile.type ?? ""),
  JSON.stringify(receiptFile),
);
check(
  "each booking keeps the price it was paid at",
  sql(`select driver_paid_price_pence from jobs where id = ${B.id}`) === "3000",
);

// The statement PDF, for staff.
const pdf = await page.evaluate(async (id) => {
  const response = await fetch(`/api/driver-pay/${id}/statement`);
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    bytes: [...new Uint8Array(await response.arrayBuffer())],
  };
}, paymentId);
const pdfBody = pdfText(pdf.bytes);
const pdfPages = pdfBody.split("\f");
const lastPage = pdfPages.at(-1) ?? "";
check(
  "the bank transfer receipt is the statement's last page, by itself",
  pdfPages.length > 1 &&
    /BANK TRANSFER RECEIPT/.test(lastPage) &&
    !lastPage.includes(A.reference) &&
    !/NET PAYMENT/.test(lastPage) &&
    pdfPages.slice(0, -1).every((each) => !/BANK TRANSFER RECEIPT/.test(each)) &&
    new RegExp(`Page ${pdfPages.length} of ${pdfPages.length}`).test(lastPage),
  `${pdfPages.length} pages`,
);
check(
  "the statement is a PDF with the bookings, the cash and the total",
  pdf.status === 200 &&
    pdf.type === "application/pdf" &&
    /PAYMENT STATEMENT/.test(pdfBody) &&
    pdfBody.includes(A.reference) &&
    pdfBody.includes(C.reference) &&
    /Less: cash received by driver/.test(pdfBody) &&
    /NET PAYMENT TO DRIVER\s*£30\.00/.test(pdfBody),
  pdfBody.slice(0, 120).replace(/\s+/g, " "),
);

// On WhatsApp, with a private link that opens without signing in.
const sendHref = await page
  .getByRole("link", { name: "Send statement on WhatsApp" })
  .getAttribute("href");
const message = decodeURIComponent(sendHref.split("text=")[1] ?? "");
const link = message.match(/https?:\/\/\S+\/api\/statements\/\S+/)?.[0] ?? "";
check(
  "the WhatsApp note says what was paid and links the statement",
  sendHref.startsWith("https://wa.me/447700900456") &&
    /Paid to you: £30\.00/.test(message) &&
    link !== "",
);
const publicPdf = await fetch(link.replace(/^https?:\/\/[^/]+/, base));
check(
  "the driver's link opens the PDF with no account",
  publicPdf.status === 200 && publicPdf.headers.get("content-type") === "application/pdf",
  `status ${publicPdf.status}`,
);
const forged = await fetch(`${base}/api/statements/${paymentId}.9999999999.forged`);
check("a forged link opens nothing", forged.status === 404);

// The server refuses what the screen would not offer.
const twice = await api("/api/driver-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    driver: sam,
    upTo: londonIso(day(0), "12:00"),
    paidAt: londonIso(day(0), "12:00"),
    method: "cash",
    lines: [{ job: A.id }],
  }),
});
check(
  "a booking cannot be paid twice",
  twice.status === 400 && /already paid/.test(JSON.stringify(twice.body)),
  `status ${twice.status}`,
);
const noPrice = await api("/api/driver-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    driver: sam,
    upTo: londonIso(day(0), "12:00"),
    paidAt: londonIso(day(0), "12:00"),
    method: "cash",
    lines: [{ job: D.id }],
  }),
});
check(
  "nor without a driver price",
  noPrice.status === 400 && /no driver price/.test(JSON.stringify(noPrice.body)),
);
const wrongDriver = await api("/api/driver-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    driver: sam,
    upTo: londonIso(day(0), "12:00"),
    paidAt: londonIso(day(0), "12:00"),
    method: "cash",
    lines: [{ job: F.id }],
  }),
});
check(
  "nor to the wrong driver",
  wrongDriver.status === 400 &&
    /not driven by this driver/.test(JSON.stringify(wrongDriver.body)),
);
const typed = await api("/api/driver-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    driver: sam,
    upTo: londonIso(day(0), "12:00"),
    paidAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    amountPence: 1,
    lines: [{ job: E.id }],
  }),
});
check(
  "a typed amount is ignored: the bookings decide",
  typed.status === 201 && typed.body?.doc?.amountPence === 2000,
  `status ${typed.status}, amount ${typed.body?.doc?.amountPence}`,
);
const edit = await api(`/api/driver-payments/${typed.body?.doc?.id}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ amountPence: 1 }),
});
check(
  "a payment cannot be edited",
  edit.status === 400 && /cannot be changed/.test(JSON.stringify(edit.body)),
);

// A price changed after payment shows on the overview.
sql(`update jobs set driver_price_pence = 2500 where id = ${E.id}`);
await page.goto(`${base}/admin/driver-pay`, { waitUntil: "networkidle" });
body = await text(page);
check(
  "a price changed after payment is shown with the difference",
  /Price changed after payment/.test(body) &&
    body.includes(E.reference) &&
    /£5\.00 more to pay/.test(body),
);
check(
  "the period shows what was paid to drivers",
  body.includes(DP(paymentId)) && /Paid to drivers/.test(body),
);

// Void.
await page.goto(`${base}/admin/driver-pay/${sam}`, { waitUntil: "networkidle" });
await page
  .locator("li", { hasText: DP(paymentId) })
  .getByRole("button", { name: "Void" })
  .click();
await page.locator("dialog[open] textarea").fill("Paid to the wrong account");
await page.locator("dialog[open]").getByRole("button", { name: "Void payment" }).click();
await page.waitForURL(/notice=voided/, { timeout: 15_000 });
body = await text(page);
check(
  "voiding keeps the payment, marked void, and frees its bookings",
  /Void: Paid to the wrong account/.test(body) &&
    sql(`select count(*) from jobs where driver_payment_id = ${paymentId}`) === "0" &&
    (await page.locator(`#pay-${A.id}`).count()) === 1,
);
check(
  "the freed bookings come back ticked, ready to pay again",
  (await page.isChecked(`#pay-${A.id}`)) && (await page.isChecked(`#pay-${C.id}`)),
);
const afterVoid = await fetch(link.replace(/^https?:\/\/[^/]+/, base));
check("the voided payment's link no longer opens", afterVoid.status === 404);

// The payments CSV.
const csv = await page.evaluate(async () => {
  const response = await fetch("/api/reports/driver-payments");
  return { status: response.status, body: await response.text() };
});
check(
  "the payments CSV lists each payment, voids marked",
  csv.status === 200 &&
    csv.body.includes(DP(paymentId)) &&
    csv.body.includes("Yes: Paid to the wrong account") &&
    csv.body.includes("Paid (£)"),
);
await page.screenshot({ path: `${shots}/driver-pay-sam.png`, fullPage: true });
await context.close();

// --- Who may see it ------------------------------------------------------------------
for (const email of ["controller@local.test", "editor@local.test"]) {
  const { page: other, context: oc } = await session(email);
  await other.goto(`${base}/admin/driver-pay`, { waitUntil: "networkidle" });
  const status = await other.evaluate(
    async (id) => (await fetch(`/api/driver-pay/${id}/statement`)).status,
    paymentId,
  );
  check(
    `${email.split("@")[0]} cannot open Driver Pay or a statement`,
    /You do not have access to this/.test(await text(other)) && status === 403,
  );
  await oc.close();
}
check(
  "signed out, a statement is refused",
  (await fetch(`${base}/api/driver-pay/${paymentId}/statement`)).status === 403,
);

// --- Phones and dark -----------------------------------------------------------------
for (const path of ["/admin/driver-pay", `/admin/driver-pay/${sam}`]) {
  const { page: mp, context: mc } = await session("accounts@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`fits a phone: ${path}`, overflow <= 0, `overflow ${overflow}px`);
  if (path.endsWith(String(sam)))
    await mp.screenshot({ path: `${shots}/driver-pay-phone.png`, fullPage: true });
  await mc.close();
}
sql("update users set ops_theme = 'dark' where email = 'accounts@local.test'");
{
  const { page: dp, context: dc } = await session("accounts@local.test");
  await dp.goto(`${base}/admin/driver-pay/${sam}`, { waitUntil: "networkidle" });
  await dp.screenshot({ path: `${shots}/driver-pay-dark.png`, fullPage: true });
  await dc.close();
}
sql("update users set ops_theme = 'light' where email = 'accounts@local.test'");

// Leave nothing behind for the other checks.
sql(`delete from private_files where id in (${fixtureReceipts})`);
sql(
  `delete from driver_payments where id in (select _parent_id from driver_payments_lines where job_id in (${fixtureJobs}))`,
);
sql(`delete from job_events where job_id in (${fixtureJobs})`);
sql(`delete from jobs where lead_phone = '${PAY_PHONE}'`);

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);

function DP(id) {
  return `DP-${String(id).padStart(6, "0")}`;
}
