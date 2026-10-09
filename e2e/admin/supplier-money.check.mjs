import "./local-only.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

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
const pounds = (pence) =>
  `${pence < 0 ? "-" : ""}£${Math.floor(Math.abs(pence) / 100).toLocaleString("en-GB")}.${String(Math.abs(pence) % 100).padStart(2, "0")}`;
function pdfText(bytes) {
  const file = `${shots}/invoice.tmp.pdf`;
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

// --- Fixtures (local database only) ------------------------------------------------
const PHONE = "+447700900663";
const PARTNER = "Check Partner Ltd";
function cleanUp() {
  const jobs = `select id from jobs where lead_phone = '${PHONE}'`;
  sql(
    `update jobs set supplier_payment_id = null, supplier_invoice_id = null where lead_phone = '${PHONE}'`,
  );
  sql(
    `delete from supplier_payments where id in (select _parent_id from supplier_payments_lines where job_id in (${jobs}))`,
  );
  sql(
    `delete from supplier_invoices where id in (select _parent_id from supplier_invoices_lines where job_id in (${jobs}))`,
  );
  sql(`delete from job_events where job_id in (${jobs})`);
  sql(`delete from jobs where lead_phone = '${PHONE}'`);
}
cleanUp();
const ownerToken = await login("owner@local.test");
const controllerToken = await login("controller@local.test");
const accountsToken = await login("accounts@local.test");
let partner = Number(sql(`select id from suppliers where name = '${PARTNER}'`) || 0);
if (!partner) {
  const created = await api("/api/suppliers", ownerToken, {
    method: "POST",
    body: JSON.stringify({
      name: PARTNER,
      paymentTermsDays: 14,
      contactName: "Accounts team",
      billingAddress: "1 Test Street\nLondon EC1A 1AA",
      active: true,
    }),
  });
  partner = created.body?.doc?.id;
}
sql(
  `update suppliers set payment_terms_days = 14, billing_address = E'1 Test Street\\nLondon EC1A 1AA', contact_name = 'Accounts team' where id = ${partner}`,
);
const otherPartner = Number(
  sql(`select id from suppliers where id <> ${partner} order by id limit 1`),
);
let serial = 0;
async function booking(
  date,
  { status = "completed", price, supplier = partner, test = false },
) {
  serial += 1;
  const reference = `CHK-${Date.now().toString().slice(-6)}${serial}`;
  const created = await api("/api/jobs", controllerToken, {
    method: "POST",
    body: JSON.stringify({
      reference: `J-S${Date.now().toString().slice(-5)}${serial}`,
      source: "supplier",
      supplier,
      supplierReference: reference,
      status: "unassigned",
      pickupAt: londonIso(date, "10:00"),
      pickupAddress: "Heathrow Terminal 5",
      dropoffAddress: "10 Wren Avenue, Uxbridge UB8 1AA",
      vehicleClassSlug: "saloon",
      passengers: 1,
      largeBags: 1,
      smallBags: 0,
      leadName: "Partner Check Passenger",
      leadPhone: PHONE,
      customerPricePence: price,
      paymentMethod: "supplier",
      isTest: test,
    }),
  });
  const id = created.body?.doc?.id;
  sql(`update jobs set status = '${status}' where id = ${id}`);
  return { id, reference: created.body?.doc?.reference, supplierReference: reference };
}
const P1 = await booking(day(-20), { price: 6000 });
const P2 = await booking(day(-3), { status: "no_show", price: 4500 });
const P3 = await booking(day(-2), { status: "cancelled", price: 5000 });
const P4 = await booking(day(-2), { status: "cancelled", price: 3000 });
const P5 = await booking(day(-2), { price: 9999, test: true });
const OTHER = await booking(day(-2), { price: 7000, supplier: otherPartner });
check(
  "the partner's bookings are set up",
  [P1, P2, P3, P4, P5, OTHER].every((job) => job.id),
);

// --- Overview, as Accounts ---------------------------------------------------------
const { page, context } = await session("accounts@local.test");
await page.goto(`${base}/admin/supplier-money`, { waitUntil: "networkidle" });
let row = (await page.locator("tr", { hasText: PARTNER }).first().innerText()).replace(
  /\s+/g,
  " ",
);
check(
  "the partner's row shows what is owed, what is overdue, and what needs deciding",
  row.includes("£105.00") && row.includes("£60.00") && /2 to decide/.test(row),
  row,
);
await page.screenshot({ path: `${shots}/supplier-money.png`, fullPage: true });

// --- The partner's page ----------------------------------------------------------------
await page.goto(`${base}/admin/supplier-money/${partner}`, { waitUntil: "networkidle" });
let body = await text(page);
check(
  "billing shows the address invoices go to, and the terms",
  /1 Test Street/.test(body) && /14 days after the pickup/.test(body),
);
check("a test booking is never billed", !body.includes(P5.reference));
const decisions = () => page.locator("section", { hasText: "Cancellations to decide" });
await decisions()
  .locator("li", { hasText: P3.reference })
  .getByRole("button", { name: "Partner pays" })
  .click();
await decisions()
  .locator("li", { hasText: P3.reference })
  .waitFor({ state: "detached", timeout: 15_000 });
await decisions()
  .locator("li", { hasText: P4.reference })
  .getByRole("button", { name: "No charge" })
  .click();
await decisions().waitFor({ state: "detached", timeout: 15_000 });
await page.waitForLoadState("networkidle");
body = await text(page);
check(
  "a late cancellation the partner pays for joins what is owed; one with no charge does not",
  sql(`select cancellation_charge from jobs where id = ${P3.id}`) === "charged" &&
    sql(`select cancellation_charge from jobs where id = ${P4.id}`) === "not_charged" &&
    (await page.locator(`#owed-${P3.id}`).count()) === 1 &&
    (await page.locator(`#owed-${P4.id}`).count()) === 0 &&
    !/Cancellations to decide/.test(body),
);
check(
  "everything owed starts ticked",
  /3 of 3 chosen/.test(body) && /Ticked\s*£155\.00/.test(body),
);

// An invoice, made by hand.
const invoices = () =>
  page.locator("section", { hasText: "Made here; sent by the office." });
await page.getByRole("button", { name: "Create invoice for £155.00" }).click();
await page.waitForURL(/notice=invoiced/, { timeout: 20_000 });
body = await text(page);
const invoiceId = Number(new URL(page.url()).searchParams.get("id"));
const INV = `INV-${String(invoiceId).padStart(6, "0")}`;
check(
  "the invoice is made from the bookings, due on the partner's terms",
  body.includes(INV) &&
    sql(
      `select total_pence || ' ' || ((due_at - issued_at) = interval '14 days') || ' ' || coalesce(sent_at::text, 'unsent') from supplier_invoices where id = ${invoiceId}`,
    ) === "15500 true unsent" &&
    sql(`select count(*) from jobs where supplier_invoice_id = ${invoiceId}`) === "3",
);
const pdf = await page.evaluate(async (id) => {
  const response = await fetch(`/api/supplier-money/invoices/${id}`);
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    bytes: [...new Uint8Array(await response.arrayBuffer())],
  };
}, invoiceId);
const pdfBody = pdfText(pdf.bytes);
check(
  "the invoice PDF has the number, the partner's address, their references, the total and no VAT",
  pdf.status === 200 &&
    pdf.type === "application/pdf" &&
    pdfBody.includes(INV) &&
    /Cityline Airport Transfers Limited/.test(pdfBody) &&
    /1 Test Street/.test(pdfBody) &&
    pdfBody.includes(P1.supplierReference) &&
    /Total due\s*£155\.00/.test(pdfBody) &&
    /No VAT is charged/.test(pdfBody),
  pdfBody.slice(0, 150).replace(/\s+/g, " "),
);
check(
  "a booking already on an invoice cannot go on another",
  (await page.getByRole("button", { name: /Create invoice/ }).isDisabled()) &&
    (await api("/api/supplier-invoices", accountsToken, {
      method: "POST",
      body: JSON.stringify({
        supplier: partner,
        issuedAt: londonIso(day(0), "12:00"),
        lines: [{ job: P1.id }],
      }),
    }).then(
      (r) => r.status === 400 && /already on an invoice/.test(JSON.stringify(r.body)),
    )),
);
await invoices()
  .locator("li", { hasText: INV })
  .getByRole("button", { name: "Mark sent" })
  .click();
await page.waitForURL(/notice=sent/, { timeout: 15_000 });
check(
  "the office marks it sent itself",
  /Sent \d/.test(await invoices().locator("li", { hasText: INV }).innerText()),
);

// Money received for two of the three.
await page.uncheck(`#owed-${P3.id}`);
await page.fill("#reference", "TRIP REMIT 1");
await page.getByRole("button", { name: "Record £105.00 received" }).click();
await page.waitForURL(/notice=received/, { timeout: 20_000 });
body = await text(page);
const receiptId = Number(new URL(page.url()).searchParams.get("id"));
const PR = `PR-${String(receiptId).padStart(6, "0")}`;
check(
  "money received is recorded against the bookings, and the invoice is part paid",
  sql(`select amount_pence from supplier_payments where id = ${receiptId}`) === "10500" &&
    sql(`select count(*) from jobs where supplier_payment_id = ${receiptId}`) === "2" &&
    /Part paid/.test(await invoices().locator("li", { hasText: INV }).innerText()),
);
const again = await api("/api/supplier-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    receivedAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    lines: [{ job: P1.id }],
  }),
});
check(
  "a booking cannot be paid for twice",
  again.status === 400 && /already paid/.test(JSON.stringify(again.body)),
);
const notCharged = await api("/api/supplier-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    receivedAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    lines: [{ job: P4.id }],
  }),
});
check(
  "nor a cancellation the partner does not pay for",
  notCharged.status === 400 && /not charged/.test(JSON.stringify(notCharged.body)),
);
const wrongPartner = await api("/api/supplier-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    receivedAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    lines: [{ job: OTHER.id }],
  }),
});
check(
  "nor another partner's booking",
  wrongPartner.status === 400 &&
    /not sent by this partner/.test(JSON.stringify(wrongPartner.body)),
);
const edit = await api(`/api/supplier-payments/${receiptId}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ amountPence: 1 }),
});
check(
  "a receipt cannot be edited",
  edit.status === 400 && /cannot be changed/.test(JSON.stringify(edit.body)),
);

// --- The rings ---------------------------------------------------------------------
const from = day(-29);
const to = day(0);
const inRange = `is_test = false and (pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}'`;
const done = `status in ('completed','no_show')`;
const chargeable = `source = 'supplier' and (${done} or (status = 'cancelled' and cancellation_charge = 'charged'))`;
const n = (q) => Number(sql(q) || 0);
const expected = {
  driverEarned: n(
    `select coalesce(sum(driver_price_pence),0) from jobs where ${inRange} and ${done} and driver_price_pence is not null`,
  ),
  driverPaid: n(
    `select coalesce(sum(driver_price_pence),0) from jobs where ${inRange} and ${done} and driver_price_pence is not null and driver_payment_id is not null`,
  ),
  owed: n(
    `select coalesce(sum(customer_price_pence),0) from jobs where ${inRange} and ${chargeable}`,
  ),
  received: n(
    `select coalesce(sum(customer_price_pence),0) from jobs where ${inRange} and ${chargeable} and supplier_payment_id is not null`,
  ),
  income: n(
    `select coalesce(sum(customer_price_pence),0) from jobs where ${inRange} and (${done} or (${chargeable}))`,
  ),
  fees: n(
    `select coalesce(sum(payment_fee_pence),0) from jobs where ${inRange} and (${done} or (${chargeable}))`,
  ),
};
const profit = expected.income - expected.driverEarned - expected.fees;
console.log("expected", JSON.stringify({ ...expected, profit }));
await page.goto(`${base}/admin/dashboard?period=last_30`, { waitUntil: "networkidle" });
const rings = (
  await page.locator("section", { hasText: "Money in and out" }).first().innerText()
).replace(/\s+/g, " ");
check(
  "the three rings match the bookings: paid to drivers, got from suppliers, profit",
  rings.includes(`Paid to drivers ${pounds(expected.driverPaid)}`) &&
    rings.includes(`of ${pounds(expected.driverEarned)} drivers earned`) &&
    rings.includes(`Got from suppliers ${pounds(expected.received)}`) &&
    rings.includes(`of ${pounds(expected.owed)} partners owe`) &&
    rings.includes(`${profit < 0 ? "Loss" : "Profit"} ${pounds(profit)}`),
  rings.slice(0, 400),
);
const ring = page.locator("[data-tip-value]", { hasText: "%" }).first();
await ring.hover();
await page.getByRole("tooltip").waitFor({ timeout: 5_000 });
check(
  "hovering a ring reads it out",
  /paid of|received of|Margin/.test(await page.getByRole("tooltip").innerText()),
);
await page.screenshot({ path: `${shots}/finance-rings.png`, fullPage: false });

// --- Voids ------------------------------------------------------------------------------
await page.goto(`${base}/admin/supplier-money/${partner}`, { waitUntil: "networkidle" });
await page.locator("li", { hasText: PR }).getByRole("button", { name: "Void" }).click();
await page.locator("dialog[open] textarea").fill("Recorded against the wrong remittance");
await page.locator("dialog[open]").getByRole("button", { name: "Void payment" }).click();
await page
  .getByText("Void: Recorded against the wrong remittance")
  .waitFor({ timeout: 15_000 });
check(
  "voiding a receipt keeps it, marked void, and its bookings are owed again",
  /Void: Recorded against the wrong remittance/.test(await text(page)) &&
    sql(`select count(*) from jobs where supplier_payment_id = ${receiptId}`) === "0" &&
    (await page.locator(`#owed-${P1.id}`).isChecked()),
);
await invoices()
  .locator("li", { hasText: INV })
  .getByRole("button", { name: "Void" })
  .click();
await page.locator("dialog[open] textarea").fill("Wrong period");
await page.locator("dialog[open]").getByRole("button", { name: "Void invoice" }).click();
await page.getByText("Void: Wrong period").waitFor({ timeout: 15_000 });
check(
  "voiding an invoice frees its bookings for a new one",
  sql(`select count(*) from jobs where supplier_invoice_id = ${invoiceId}`) === "0" &&
    !(await page.getByRole("button", { name: /Create invoice/ }).isDisabled()),
);
const csv = await page.evaluate(async () => {
  const response = await fetch("/api/reports/partner-receipts");
  return { status: response.status, body: await response.text() };
});
check(
  "the receipts CSV lists money received, voids marked",
  csv.status === 200 &&
    csv.body.includes(PR) &&
    csv.body.includes("Yes: Recorded against the wrong remittance"),
);
await page.screenshot({ path: `${shots}/supplier-money-partner.png`, fullPage: true });
await context.close();

// --- Who may see it -----------------------------------------------------------------------
{
  const { page: cp, context: cc } = await session("controller@local.test");
  await cp.goto(`${base}/admin/supplier-money`, { waitUntil: "networkidle" });
  const denied = /You do not have access to this/.test(await text(cp));
  const status = await cp.evaluate(
    async (id) => (await fetch(`/api/supplier-money/invoices/${id}`)).status,
    invoiceId,
  );
  await cp.goto(`${base}/admin/dashboard`, { waitUntil: "networkidle" });
  check(
    "the controller sees neither Supplier Money, invoices nor the rings",
    denied && status === 403 && !/Money in and out/.test(await text(cp)),
  );
  await cc.close();
}
check(
  "signed out, an invoice is refused",
  (await fetch(`${base}/api/supplier-money/invoices/${invoiceId}`)).status === 403,
);

// --- Phones and dark -------------------------------------------------------------------------
for (const path of [
  "/admin/supplier-money",
  `/admin/supplier-money/${partner}`,
  "/admin/dashboard",
]) {
  const { page: mp, context: mc } = await session("accounts@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`fits a phone: ${path}`, overflow <= 0, `overflow ${overflow}px`);
  if (path === "/admin/dashboard")
    await mp.screenshot({ path: `${shots}/finance-rings-phone.png`, fullPage: true });
  await mc.close();
}
sql("update users set ops_theme = 'dark' where email = 'accounts@local.test'");
{
  const { page: dp, context: dc } = await session("accounts@local.test");
  await dp.goto(`${base}/admin/dashboard?period=last_30`, { waitUntil: "networkidle" });
  await dp.screenshot({ path: `${shots}/finance-rings-dark.png`, fullPage: false });
  await dc.close();
}
sql("update users set ops_theme = 'light' where email = 'accounts@local.test'");

cleanUp();
check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
