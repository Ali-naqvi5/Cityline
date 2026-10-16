import "./local-only.mjs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

/**
 * Partner penalties and loss bookings (Cityline, 16 Oct 2026): a penalty
 * recorded by hand on a partner booking, taken off the partner's payment and
 * invoice, part of it off the driver's pay and statement; voids in the right
 * order; the booking's loss; and the loss warning on a driver price.
 */

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
function pdfText(bytes) {
  const file = `${shots}/penalty.tmp.pdf`;
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
const firstError = (result) =>
  JSON.stringify(result.body?.errors?.[0]?.data?.errors ?? result.body?.errors ?? "");
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
const text = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ");

// --- Fixtures (local database only) ------------------------------------------------
const PHONE = "+447700900664";
const PARTNER = "Penalty Check Partner Ltd";
const DRIVER = Number(
  sql(
    "select id from drivers where status = 'active' and engagement = 'registered' order by id limit 1",
  ),
);
function cleanUp() {
  const jobs = `select id from jobs where lead_phone = '${PHONE}'`;
  const penalties = `select id from partner_penalties where job_id in (${jobs})`;
  sql(
    `update jobs set supplier_payment_id = null, supplier_invoice_id = null, driver_payment_id = null where lead_phone = '${PHONE}'`,
  );
  sql(
    `delete from driver_payments where id in (select _parent_id from driver_payments_lines where job_id in (${jobs})) or id in (select _parent_id from driver_payments_penalties where penalty_id in (${penalties}))`,
  );
  sql(
    `delete from supplier_payments where id in (select _parent_id from supplier_payments_lines where job_id in (${jobs}))`,
  );
  sql(
    `delete from supplier_invoices where id in (select _parent_id from supplier_invoices_lines where job_id in (${jobs}))`,
  );
  sql(`delete from partner_penalties where job_id in (${jobs})`);
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
    body: JSON.stringify({ name: PARTNER, paymentTermsDays: 14, active: true }),
  });
  partner = created.body?.doc?.id;
}
let serial = 0;
async function booking({ status = "completed", price, driverPrice = null }) {
  serial += 1;
  const reference = `PEN-${Date.now().toString().slice(-6)}${serial}`;
  const created = await api("/api/jobs", controllerToken, {
    method: "POST",
    body: JSON.stringify({
      reference: `J-P${Date.now().toString().slice(-5)}${serial}`,
      source: "supplier",
      supplier: partner,
      supplierReference: reference,
      status: "unassigned",
      pickupAt: londonIso(day(-3), "10:00"),
      pickupAddress: "Gatwick North Terminal",
      dropoffAddress: "10 Wren Avenue, Uxbridge UB8 1AA",
      vehicleClassSlug: "saloon",
      passengers: 1,
      largeBags: 1,
      smallBags: 0,
      leadName: "Penalty Check Passenger",
      leadPhone: PHONE,
      customerPricePence: price,
      paymentMethod: "supplier",
    }),
  });
  const id = created.body?.doc?.id;
  sql(
    `update jobs set status = '${status}', driver_id = ${DRIVER}, driver_price_pence = ${driverPrice ?? "null"} where id = ${id}`,
  );
  return { id, reference: created.body?.doc?.reference, supplierReference: reference };
}
// £20 booking with a £20 driver price; a £100 booking with £35.
const B1 = await booking({ price: 2000, driverPrice: 2000 });
const B2 = await booking({ price: 10000, driverPrice: 3500 });
const NOT_DONE = await booking({ status: "driver_confirmed", price: 5000 });
check(
  "the partner's bookings and the driver are set up",
  DRIVER > 0 && [B1, B2, NOT_DONE].every((job) => job.id),
);

// --- Recording a penalty: the rules ------------------------------------------------------
const record = (token, data) =>
  api("/api/partner-penalties", token, { method: "POST", body: JSON.stringify(data) });
const penaltyData = {
  job: B1.id,
  penalisedAt: londonIso(day(-1), "12:00"),
  amountPence: 1000,
  driverSharePence: 500,
  reason: "Driver 20 minutes late at Gatwick North",
  partnerReference: "FINE-1",
};
check(
  "the Controller cannot record a penalty: it is Finance's",
  (await record(controllerToken, penaltyData)).status === 403,
);
const tooMuch = await record(accountsToken, { ...penaltyData, driverSharePence: 1500 });
check(
  "a driver's share more than the penalty is refused",
  tooMuch.status === 400 && /more than the penalty/.test(firstError(tooMuch)),
  firstError(tooMuch),
);
const early = await record(accountsToken, { ...penaltyData, job: NOT_DONE.id });
check(
  "a booking not done yet cannot be fined",
  early.status === 400 && /not completed, PNS or cancelled/.test(firstError(early)),
  firstError(early),
);
const created = await record(accountsToken, penaltyData);
const PENALTY = created.body?.doc?.id;
check("Accounts records a £10 penalty, £5 of it from the driver", created.status === 201);
check(
  "the penalty is the booking's partner's, and its share is the booking's driver's",
  sql(
    `select supplier_id || '/' || driver_id from partner_penalties where id = ${PENALTY}`,
  ) === `${partner}/${DRIVER}`,
);

// --- The booking's money: a loss ---------------------------------------------------------
{
  const { page, context } = await session("accounts@local.test");
  await page.goto(`${base}/admin/jobs/${B1.id}`, { waitUntil: "networkidle" });
  const body = await text(page);
  check(
    "the booking shows the penalty Cityline bears, and the loss",
    body.includes("Partner penalties Cityline bears − £5.00") &&
      /Loss -£5\.00/.test(body) &&
      body.includes("PN-"),
    body.slice(body.indexOf("Finance"), body.indexOf("Finance") + 400),
  );
  check(
    "it says who bears what",
    body.includes("£5.00 from") && body.includes("Cityline bears £5.00"),
  );
  await page.screenshot({ path: `${shots}/penalty-booking.png`, fullPage: true });

  // A second penalty recorded on the screen, Cityline bearing it all.
  await page.getByText("Record a partner penalty").click();
  await page.locator("#amount").fill("2.50");
  await page.locator("#reason").fill("Passenger waited at the wrong meeting point");
  await page.getByRole("button", { name: "Record £2.50 penalty" }).click();
  await page.waitForURL(/notice=penalty/);
  check(
    "a penalty recorded on the booking's page",
    (await text(page)).includes("Partner penalty recorded") &&
      sql(
        `select count(*) from partner_penalties where job_id = ${B1.id} and amount_pence = 250 and driver_share_pence = 0`,
      ) === "1",
  );
  await context.close();
}

// --- The partner's money: penalties come off ---------------------------------------------
{
  const { page, context } = await session("accounts@local.test");
  await page.goto(`${base}/admin/supplier-money/${partner}`, {
    waitUntil: "networkidle",
  });
  const body = await text(page);
  check(
    "the partner's page takes both penalties off what is owed",
    body.includes("less £12.50 penalties: £107.50") &&
      body.includes("Penalties to take off") &&
      body.includes("Record £107.50 received"),
    body.slice(body.indexOf("Owed up to"), body.indexOf("Owed up to") + 300),
  );
  await page.screenshot({ path: `${shots}/penalty-partner.png`, fullPage: true });
  await context.close();
}
const second = Number(
  sql(`select id from partner_penalties where job_id = ${B1.id} and amount_pence = 250`),
);
const invoice = await api("/api/supplier-invoices", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    issuedAt: londonIso(day(0), "12:00"),
    lines: [{ job: B1.id }, { job: B2.id }],
    penalties: [{ penalty: PENALTY }],
  }),
});
check(
  "an invoice shows the penalty as a minus line: £120 less £10",
  invoice.status === 201 && invoice.body?.doc?.totalPence === 11000,
  JSON.stringify(invoice.body?.doc?.totalPence ?? firstError(invoice)),
);
const invoicePdf = await fetch(
  `${base}/api/supplier-money/invoices/${invoice.body?.doc?.id}`,
  {
    headers: { Authorization: `JWT ${accountsToken}` },
  },
);
const invoiceText = pdfText(await invoicePdf.arrayBuffer());
check(
  "the invoice PDF lists the penalty and the total due",
  invoiceText.includes("Penalty") &&
    invoiceText.includes("-£10.00") &&
    invoiceText.includes("£110.00"),
);
const big = await record(accountsToken, {
  ...penaltyData,
  job: B2.id,
  amountPence: 2500,
  driverSharePence: 0,
});
const tooBig = await api("/api/supplier-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    receivedAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    lines: [{ job: B1.id }],
    penalties: [{ penalty: big.body?.doc?.id }],
  }),
});
check(
  "penalties cannot come to more than the bookings on a payment",
  tooBig.status === 400 && /more than the bookings/.test(firstError(tooBig)),
  firstError(tooBig),
);
const bigVoid = await api(`/api/partner-penalties/${big.body?.doc?.id}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ voidReason: "Recorded twice" }),
});
check(
  "a penalty nothing holds is voided, with a reason",
  bigVoid.status === 200 && Boolean(bigVoid.body?.doc?.voidedAt),
);
const receipt = await api("/api/supplier-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    receivedAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    lines: [{ job: B1.id }, { job: B2.id }],
    penalties: [{ penalty: PENALTY }],
  }),
});
const RECEIPT = receipt.body?.doc?.id;
check(
  "the partner's payment is the bookings less the penalty: £110, as the bank got",
  receipt.status === 201 &&
    receipt.body?.doc?.amountPence === 11000 &&
    receipt.body?.doc?.bookingsPence === 12000 &&
    receipt.body?.doc?.penaltiesPence === 1000,
  JSON.stringify(receipt.body?.doc?.amountPence ?? firstError(receipt)),
);
check(
  "the penalty points at the payment it was taken off",
  sql(`select supplier_payment_id from partner_penalties where id = ${PENALTY}`) ===
    String(RECEIPT),
);
const twice = await api("/api/supplier-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    supplier: partner,
    receivedAt: londonIso(day(0), "12:00"),
    method: "bank_transfer",
    lines: [{ job: B2.id }],
    penalties: [{ penalty: PENALTY }],
  }),
});
check("a penalty is taken off once", twice.status === 400);
const heldVoid = await api(`/api/partner-penalties/${PENALTY}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ voidReason: "Wrong booking" }),
});
check(
  "a penalty held by a payment cannot be voided first",
  heldVoid.status === 400 && /Void that first/.test(firstError(heldVoid)),
  firstError(heldVoid),
);

// --- The driver's pay: their share comes off ------------------------------------------
{
  const { page, context } = await session("accounts@local.test");
  await page.goto(`${base}/admin/driver-pay/${DRIVER}`, { waitUntil: "networkidle" });
  const body = await text(page);
  check(
    "Driver Pay lists the driver's share to take off, ticked",
    body.includes("Partner penalties to take off") &&
      (await page.locator(`#deduct-${PENALTY}`).isChecked()) &&
      !(await page.locator(`#deduct-${second}`).count()),
  );
  await context.close();
}
const pay = await api("/api/driver-payments", accountsToken, {
  method: "POST",
  body: JSON.stringify({
    driver: DRIVER,
    upTo: londonIso(day(0), "12:00"),
    paidAt: londonIso(day(0), "12:00"),
    method: "cash",
    lines: [{ job: B1.id }, { job: B2.id }],
    penalties: [{ penalty: PENALTY }],
  }),
});
const PAYMENT = pay.body?.doc?.id;
check(
  "the driver is paid £55 less their £5 share: £50",
  pay.status === 201 &&
    pay.body?.doc?.earnedPence === 5500 &&
    pay.body?.doc?.penaltiesPence === 500 &&
    pay.body?.doc?.amountPence === 5000,
  JSON.stringify(pay.body?.doc?.amountPence ?? firstError(pay)),
);
const statement = await fetch(`${base}/api/driver-pay/${PAYMENT}/statement`, {
  headers: { Authorization: `JWT ${accountsToken}` },
});
const statementText = pdfText(await statement.arrayBuffer());
check(
  "the statement lists the penalty and takes it off",
  statementText.includes("PENALTIES TAKEN OFF") &&
    statementText.includes("Less: penalties") &&
    statementText.includes("Driver 20 minutes late"),
);

// --- The money reports count it ----------------------------------------------------------
{
  const csv = await fetch(`${base}/api/reports/finance?from=${day(-1)}&to=${day(1)}`, {
    headers: { Authorization: `JWT ${accountsToken}` },
  }).then((response) => response.text());
  check(
    "Financial Reports count the penalty and the driver's share on their days",
    csv.includes("Partner penalty, taken off their payment") &&
      csv.includes("Penalty share, taken off a driver's payment"),
  );
}

// --- Voids, in order ----------------------------------------------------------------------
await api(`/api/driver-payments/${PAYMENT}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ voidReason: "Penalty check" }),
});
await api(`/api/supplier-payments/${RECEIPT}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ voidReason: "Penalty check" }),
});
await api(`/api/supplier-invoices/${invoice.body?.doc?.id}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ voidReason: "Penalty check" }),
});
check(
  "voiding the payments and invoice frees the penalty",
  sql(
    `select coalesce(supplier_payment_id, 0) + coalesce(supplier_invoice_id, 0) + coalesce(driver_payment_id, 0) from partner_penalties where id = ${PENALTY}`,
  ) === "0",
);
const voided = await api(`/api/partner-penalties/${PENALTY}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ voidReason: "Recorded on the wrong booking" }),
});
check("then the penalty can be voided", voided.status === 200);
const edited = await api(`/api/partner-penalties/${PENALTY}`, accountsToken, {
  method: "PATCH",
  body: JSON.stringify({ amountPence: 1 }),
});
check("a penalty is never edited", edited.status === 400);

// --- The loss warning on a driver price ---------------------------------------------------
{
  const { page, context } = await session("owner@local.test");
  await page.goto(`${base}/admin/jobs/${B2.id}`, { waitUntil: "networkidle" });
  check(
    "no warning at a driver price under the agreed price",
    !(await text(page)).includes("This booking loses"),
  );
  await page.locator("#driverPrice").fill("130");
  check(
    "a driver price above the agreed price warns what the booking loses",
    (await text(page)).includes("This booking loses £30.00"),
  );
  await page.screenshot({ path: `${shots}/penalty-loss-warning.png`, fullPage: false });
  await context.close();
}

// --- Phone width ---------------------------------------------------------------------------
for (const path of [`/admin/jobs/${B1.id}`, `/admin/supplier-money/${partner}`]) {
  const { page, context } = await session("accounts@local.test", {
    width: 390,
    height: 844,
  });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`fits a phone: ${path}`, overflow <= 0, `overflow ${overflow}px`);
  await context.close();
}

cleanUp();
check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
