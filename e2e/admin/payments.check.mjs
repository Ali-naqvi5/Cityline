import "./local-only.mjs";
import { execFileSync } from "node:child_process";

import { chromium } from "@playwright/test";
import Stripe from "stripe";

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
async function login(email) {
  const response = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await response.json()).token;
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
const flat = async (page) => (await text(page)).replace(/\s+/g, " ");

// --- Fixtures ---------------------------------------------------------------------
// Two real website bookings (Stripe sandbox payments 5 and 6), their fees
// forgotten; four office bookings switched from cash to card link, bank
// transfer and account for the check, and put back after.
const WEB = { payment: 5, booking: "CL-BBQQ6F", jobs: [8, 9], other: 6, otherJob: 10 };
// Office bookings, found afresh each run (other checks recreate them): a PNS
// already picked up, and three still to come.
const one = (q) => sql(q).split(/\s+/)[0] ?? "";
const PNS = Number(
  one(
    "select id from jobs where is_test = false and source = 'phone' and status = 'no_show' and payment_method = 'cash' and customer_payment_id is null order by id limit 1",
  ),
);
const [A, B, C] = sql(
  "select id from jobs where is_test = false and source = 'phone' and status = 'unassigned' and payment_method = 'cash' and customer_payment_id is null order by pickup_at, id limit 3",
)
  .split(/\s+/)
  .map(Number);
const CASH = Number(
  one(
    `select id from jobs where is_test = false and payment_method = 'cash' and id not in (${PNS}, ${A}, ${B}, ${C}) order by id limit 1`,
  ),
);
const ref = (id) => sql(`select reference from jobs where id = ${id}`);
const R = { pns: ref(PNS), a: ref(A), b: ref(B), c: ref(C), cash: ref(CASH) };
const priceOf = (id) =>
  Number(sql(`select customer_price_pence from jobs where id = ${id}`));
const PAID = priceOf(A) + priceOf(B);
const pounds = (pence) =>
  `£${Math.floor(pence / 100).toLocaleString("en-GB")}.${String(pence % 100).padStart(2, "0")}`;
const OFFICE = { [PNS]: "bank", [A]: "bank", [B]: "card_link", [C]: "account" };
const startRefund = Number(sql("select coalesce(max(id),0) from refunds"));
const startPayment = Number(sql("select coalesce(max(id),0) from customer_payments"));
function reset() {
  sql(
    `delete from refunds_lines where _parent_id in (select id from refunds where id > ${startRefund})`,
  );
  sql(`delete from refunds where id > ${startRefund}`);
  sql(
    `update jobs set customer_payment_id = null, customer_paid_price_pence = null, payment_fee_pence = 0 where customer_payment_id > ${startPayment}`,
  );
  sql(
    `delete from customer_payments_lines where _parent_id in (select id from customer_payments where id > ${startPayment})`,
  );
  sql(`delete from customer_payments where id > ${startPayment}`);
  sql(`delete from webhook_events where event_id like 'evt_CHECK%'`);
}
reset();
sql(
  `update payments set fee_pence = 0, fee_recorded_at = null, stripe_charge_id = null where id in (${WEB.payment}, ${WEB.other})`,
);
sql(
  `update jobs set payment_fee_pence = 0 where id in (${[...WEB.jobs, WEB.otherJob].join(",")})`,
);
for (const [id, method] of Object.entries(OFFICE)) {
  sql(`update jobs set payment_method = '${method}' where id = ${id}`);
}

try {
  // --- The webhook records Stripe's fee on charge.updated -----------------------------
  {
    const pi = sql(
      `select stripe_payment_intent_id from payments where id = ${WEB.other}`,
    );
    const event = JSON.stringify({
      id: `evt_CHECK_${Date.now()}`,
      object: "event",
      type: "charge.updated",
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "ch_check",
          object: "charge",
          payment_intent: pi,
          balance_transaction: "txn_check",
        },
      },
    });
    const header = new Stripe(
      "unused: only signs a test webhook",
    ).webhooks.generateTestHeaderString({
      payload: event,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    const response = await fetch(`${base}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": header },
      body: event,
    });
    const fee = Number(sql(`select fee_pence from payments where id = ${WEB.other}`));
    check(
      "the webhook reads Stripe's fee when charge.updated says it is ready",
      response.status === 200 &&
        fee > 0 &&
        sql(
          `select fee_recorded_at is not null from payments where id = ${WEB.other}`,
        ) === "t" &&
        Number(sql(`select payment_fee_pence from jobs where id = ${WEB.otherJob}`)) ===
          fee,
      `status ${response.status}, fee ${fee}`,
    );
  }

  // --- Accounts: money in, and the card fees from Stripe -------------------------------
  const { page, context } = await session("accounts@local.test");
  await page.goto(`${base}/admin/payments?period=last_30`, { waitUntil: "networkidle" });
  const nav = await page.locator("aside").innerText();
  check(
    "Payments and Refunds are open in the menu",
    /Payments/.test(nav) &&
      /Refunds/.test(nav) &&
      !/Payments\s*Soon/.test(nav) &&
      !/Refunds\s*Soon/.test(nav),
  );
  let body = await flat(page);
  check(
    "the website card payments are listed, one fee not known yet",
    body.includes(WEB.booking) &&
      body.includes("CL-J2K9M7") &&
      /1 payment with no fee from Stripe yet/.test(body) &&
      /Not yet/.test(body),
  );
  await page.getByRole("button", { name: /Get 1 card fee from Stripe/ }).click();
  await page.getByText("1 card fee read from Stripe.").waitFor({ timeout: 30_000 });
  const fee = Number(sql(`select fee_pence from payments where id = ${WEB.payment}`));
  const shares = sql(
    `select string_agg(payment_fee_pence::text, '+' order by id) from jobs where id in (${WEB.jobs.join(",")})`,
  );
  check(
    "Stripe's fee is read and shared across the booking's two journeys",
    fee > 0 &&
      shares
        .split("+")
        .map(Number)
        .reduce((a, b) => a + b, 0) === fee,
    `fee ${fee}, shares ${shares}`,
  );
  body = await flat(page);
  check(
    "every card fee is known now",
    !/no fee from Stripe yet/.test(body) && !/Get \d+ card fee/.test(body),
  );

  // --- Marking office bookings paid ----------------------------------------------------
  check(
    "office bookings paid by card link, bank transfer or on account wait for payment",
    [R.pns, R.a, R.b, R.c].every((reference) => body.includes(reference)) &&
      /Picked up, not paid/.test(body) &&
      !body.includes(R.cash),
  );
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByText("Choose at least one booking.").waitFor({ timeout: 10_000 });
  check("a payment needs a booking ticked", true);
  await page.locator(`label[for="awaiting-${A}"]`).click();
  await page.locator(`label[for="awaiting-${B}"]`).click();
  check(
    "ticking shows the total",
    (await page.getByRole("button", { name: `Record ${pounds(PAID)} paid` }).count()) ===
      1,
  );
  await page.fill("#reference", "CHECK BACS 1");
  await page.fill("#paidBy", "CHECK Ltd");
  await page.fill("#fee", "0.51");
  await page.getByRole("button", { name: `Record ${pounds(PAID)} paid` }).click();
  await page.getByText("Payment recorded.").waitFor({ timeout: 20_000 });
  const cp = Number(sql(`select max(id) from customer_payments`));
  check(
    "the payment is saved from the bookings, and the card fee shared",
    sql(
      `select amount_pence || ' ' || fee_pence || ' ' || method || ' ' || paid_by from customer_payments where id = ${cp}`,
    ) === `${PAID} 51 bank_transfer CHECK Ltd` &&
      sql(
        `select count(*) || ':' || sum(payment_fee_pence) || ':' || sum(customer_paid_price_pence) from jobs where customer_payment_id = ${cp}`,
      ) === `2:51:${PAID}`,
  );
  body = await flat(page);
  const waitingPanel = (
    await page.locator("form", { hasText: "ticked" }).first().innerText()
  ).replace(/\s+/g, " ");
  check(
    "paid bookings stop waiting",
    !waitingPanel.includes(R.a) &&
      !waitingPanel.includes(R.b) &&
      waitingPanel.includes(R.c),
  );
  check(
    "the payment is in the money in",
    body.includes(`CP-${String(cp).padStart(6, "0")}`) &&
      body.includes("paid by CHECK Ltd"),
  );

  const token = await login("accounts@local.test");
  const again = await fetch(`${base}/api/customer-payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify({
      paidAt: new Date().toISOString(),
      method: "bank_transfer",
      lines: [{ job: A }],
    }),
  });
  check(
    "a booking cannot be paid for twice",
    again.status === 400 && /already paid/.test(await again.text()),
  );
  const cash = await fetch(`${base}/api/customer-payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify({
      paidAt: new Date().toISOString(),
      method: "bank_transfer",
      lines: [{ job: CASH }],
    }),
  });
  check(
    "nor a cash booking marked paid here",
    cash.status === 400 && /paid cash/.test(await cash.text()),
  );

  // --- A refund on a website payment --------------------------------------------------
  await page.goto(`${base}/admin/payments/website/${WEB.payment}`, {
    waitUntil: "networkidle",
  });
  body = await flat(page);
  check(
    "the card payment's page shows its journeys, its fee and the link to Stripe",
    body.includes("J-000008") &&
      body.includes("J-000009") &&
      body.includes(`− £${(fee / 100).toFixed(2)}`) &&
      (
        await page.getByRole("link", { name: "Open in Stripe" }).getAttribute("href")
      ).includes("dashboard.stripe.com"),
  );
  await page.getByRole("button", { name: "Record refund" }).click();
  await page.getByText("Enter the amount refunded.").waitFor({ timeout: 10_000 });
  check(
    "a refund needs an amount and a reason",
    /Write why the money went back/.test(await text(page)),
  );
  await page
    .locator("li", { hasText: "J-000009" })
    .getByRole("button", { name: "All of it" })
    .click();
  check(
    "'All of it' fills in what is left",
    (await page.inputValue("#amount-9")) === "68.00",
  );
  await page.fill("#reference", "re_CHECK12345678");
  await page.fill("#reason", "CHECK Return leg cancelled");
  await page.getByRole("button", { name: "Record £68.00 refunded" }).click();
  await page.getByText("Refund recorded.").waitFor({ timeout: 20_000 });
  const rf = Number(sql(`select max(id) from refunds`));
  check(
    "the refund is recorded against the payment and the journey",
    sql(
      `select amount_pence || ' ' || method || ' ' || stripe_refund_id || ' ' || payment_id from refunds where id = ${rf}`,
    ) === `6800 stripe re_CHECK12345678 ${WEB.payment}` &&
      sql(
        `select job_id || ':' || amount_pence from refunds_lines where _parent_id = ${rf}`,
      ) === "9:6800",
  );
  body = await flat(page);
  check(
    "the payment shows it part refunded",
    /Part refunded/.test(body) && /£68\.00 refunded/.test(body),
  );
  check(
    "a fully refunded journey leaves the form",
    (await page.locator("#amount-9").count()) === 0 &&
      (await page.locator("#amount-8").count()) === 1,
  );

  await page.fill("#amount-8", "100");
  await page.fill("#reason", "CHECK too much");
  await page.getByRole("button", { name: "Record £100.00 refunded" }).click();
  await page
    .getByText("J-000008 has only £68.00 left to refund.")
    .waitFor({ timeout: 15_000 });
  check("never more than was paid for a journey", true);
  await page.fill("#amount-8", "1");
  await page.fill("#reference", "re_CHECK12345678");
  await page.getByRole("button", { name: "Record £1.00 refunded" }).click();
  await page
    .getByText(/That Stripe refund is already recorded/)
    .waitFor({ timeout: 15_000 });
  check("the same Stripe refund cannot be recorded twice", true);

  // --- The booking's page ---------------------------------------------------------------
  await page.goto(`${base}/admin/jobs/9`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "the booking shows it was paid on the website, and refunded",
    /Card on the website, 28 Sept? 2026/.test(body) && /Refunded − £68\.00/.test(body),
  );
  await page.goto(`${base}/admin/jobs/${C}`, { waitUntil: "networkidle" });
  check(
    "an unpaid account booking says so",
    /Waiting for payment/.test(await text(page)),
  );

  // --- Refunds, and finding a payment by booking ------------------------------------
  await page.goto(`${base}/admin/refunds?period=last_30`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "Refunds lists it, with the total",
    body.includes(`RF-${String(rf).padStart(6, "0")}`) &&
      /Refunded £68\.00/.test(body) &&
      body.includes("CHECK Return leg cancelled"),
  );
  await page.fill("#refund-reference", R.c);
  await page.getByRole("button", { name: "Find the payment" }).click();
  await page
    .getByText(`${R.c} is not marked paid yet. Mark it paid on Payments first.`)
    .waitFor({ timeout: 15_000 });
  check("an unpaid booking is turned away", true);
  await page.fill("#refund-reference", "cl-bbqq6f");
  await page.getByRole("button", { name: "Find the payment" }).click();
  await page.waitForURL(new RegExp(`/admin/payments/website/${WEB.payment}`), {
    timeout: 15_000,
  });
  check("a website booking's reference finds its card payment", true);
  await page.goto(`${base}/admin/refunds`, { waitUntil: "networkidle" });
  await page.fill("#refund-reference", R.a);
  await page.getByRole("button", { name: "Find the payment" }).click();
  await page.waitForURL(new RegExp(`/admin/payments/office/${cp}`), { timeout: 15_000 });
  check("an office booking's reference finds its payment", true);

  // --- A refund on an office payment, voids -------------------------------------------
  await page.fill(`#amount-${A}`, "10");
  await page.selectOption("#method", "bank_transfer");
  await page.fill("#reason", "CHECK goodwill");
  await page.getByRole("button", { name: "Record £10.00 refunded" }).click();
  await page.getByText("Refund recorded.").waitFor({ timeout: 20_000 });
  const rf2 = Number(sql(`select max(id) from refunds`));
  check(
    "an office refund records how it went back",
    sql(`select method || ' ' || customer_payment_id from refunds where id = ${rf2}`) ===
      `bank_transfer ${cp}`,
  );
  check(
    "a payment with refunds cannot be voided",
    (await page.getByRole("button", { name: "Void this payment" }).count()) === 0,
  );
  await page
    .locator("li", { hasText: `RF-${String(rf2).padStart(6, "0")}` })
    .getByRole("button", { name: "Void" })
    .click();
  await page.locator("dialog[open] textarea").fill("CHECK entered by mistake");
  await page.locator("dialog[open]").getByRole("button", { name: "Void refund" }).click();
  await page.getByText("Refund voided.").waitFor({ timeout: 15_000 });
  check(
    "a void refund stays on record",
    sql(`select voided_at is not null from refunds where id = ${rf2}`) === "t" &&
      /Void: CHECK entered by mistake/.test(await text(page)),
  );
  await page.getByRole("button", { name: "Void this payment" }).click();
  await page.locator("dialog[open] textarea").fill("CHECK wrong bookings");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Void payment" })
    .click();
  await page
    .getByText("Payment voided. Its bookings are waiting for payment again.")
    .waitFor({ timeout: 15_000 });
  check(
    "voiding frees its bookings and their card fee",
    sql(
      `select count(*) from jobs where id in (${A}, ${B}) and customer_payment_id is null and payment_fee_pence = 0`,
    ) === "2",
  );
  const edit = await fetch(`${base}/api/refunds/${rf}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify({ amountPence: 1 }),
  });
  check("a refund cannot be edited", edit.status === 400);
  const remove = await fetch(`${base}/api/refunds/${rf}`, {
    method: "DELETE",
    headers: { Authorization: `JWT ${token}` },
  });
  check(
    "nor deleted",
    remove.status === 403 || remove.status === 405,
    `status ${remove.status}`,
  );

  // --- A paid booking cancelled; a refund on work done comes off profit ---------------
  sql(
    `update jobs set status = 'cancelled', cancelled_at = now() where id = ${WEB.otherJob}`,
  );
  await page.goto(`${base}/admin/refunds?period=last_30`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "a paid booking cancelled with nothing refunded is listed",
    /Cancelled and paid, nothing refunded/.test(body) &&
      body.includes("J-000010") &&
      /paid £68\.00/.test(body),
  );
  sql(
    `update jobs set status = 'completed', cancelled_at = null where id = ${WEB.otherJob}`,
  );
  const ringsText = async () => {
    await page.goto(
      `${base}/admin/dashboard?period=custom&from=2026-09-01&to=2026-10-31`,
      { waitUntil: "networkidle" },
    );
    return (
      await page.locator("section", { hasText: "Money in and out" }).first().innerText()
    ).replace(/\s+/g, " ");
  };
  const ringsBefore = await ringsText();
  await page.goto(`${base}/admin/payments/website/${WEB.other}`, {
    waitUntil: "networkidle",
  });
  await page.fill("#amount-10", "5");
  await page.fill("#reason", "CHECK late driver");
  await page.getByRole("button", { name: "Record £5.00 refunded" }).click();
  await page.getByText("Refund recorded.").waitFor({ timeout: 20_000 });
  const ringsAfter = await ringsText();
  const profitOf = (rings) => {
    const match = rings.match(/(Profit|Loss) (-?£[\d,]+\.\d\d)/);
    return match ? Math.round(Number(match[2].replace(/[£,]/g, "")) * 100) : NaN;
  };
  check(
    "a refund on a completed booking comes off profit",
    /£5\.00 refunds/.test(ringsAfter) &&
      profitOf(ringsBefore) - profitOf(ringsAfter) === 500,
    `${profitOf(ringsBefore)} → ${profitOf(ringsAfter)}`,
  );
  await page.goto(`${base}/admin/jobs/${WEB.otherJob}`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "the booking's own profit counts its refund and card fee",
    /Refunded − £5\.00/.test(body) && /Profit £[\d.]+/.test(body),
  );

  // --- CSVs and the dashboard -----------------------------------------------------------
  const csvs = await page.evaluate(async () => {
    const payments = await fetch("/api/reports/payments?period=last_30");
    const refunds = await fetch("/api/reports/refunds?period=last_30");
    return {
      p: payments.status,
      pb: await payments.text(),
      r: refunds.status,
      rb: await refunds.text(),
    };
  });
  check(
    "the CSVs hold the payments and refunds, voids marked",
    csvs.p === 200 &&
      csvs.pb.includes("CL-BBQQ6F") &&
      csvs.pb.includes("Card fee (£)") &&
      csvs.pb.includes("Yes: CHECK wrong bookings") &&
      csvs.r === 200 &&
      csvs.rb.includes("re_CHECK12345678") &&
      csvs.rb.includes("J-000009 68.00"),
  );
  await page.goto(`${base}/admin/dashboard`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "the dashboard's money is Payments' money",
    /Money · October 2026/.test(body) && /Money in from customers/.test(body),
  );
  await page.goto(`${base}/admin/payments/website/${WEB.payment}`, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: `${shots}/payment.png`, fullPage: true });
  await page.goto(`${base}/admin/payments?period=last_30`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${shots}/payments.png`, fullPage: true });
  await context.close();

  // --- Who may not ------------------------------------------------------------------------
  for (const email of ["controller@local.test", "editor@local.test"]) {
    const { page: other, context: oc } = await session(email);
    await other.goto(`${base}/admin/payments`, { waitUntil: "networkidle" });
    const denied = /You do not have access to this/.test(await text(other));
    await other.goto(`${base}/admin/refunds`, { waitUntil: "networkidle" });
    const deniedRefunds = /You do not have access to this/.test(await text(other));
    const status = await other.evaluate(
      async () => (await fetch("/api/reports/payments")).status,
    );
    const rows = await other.evaluate(async () => (await fetch("/api/refunds")).status);
    check(
      `${email.split("@")[0]} sees no payments or refunds`,
      denied && deniedRefunds && status === 403 && rows === 403,
      `${status} ${rows}`,
    );
    await oc.close();
  }
  check(
    "signed out, the CSV is refused",
    (await fetch(`${base}/api/reports/refunds`)).status === 403,
  );

  // --- Phone and dark ----------------------------------------------------------------------
  {
    const { page: mp, context: mc } = await session("accounts@local.test", {
      width: 390,
      height: 844,
    });
    for (const path of [
      "/admin/payments?period=last_30",
      `/admin/payments/website/${WEB.payment}`,
      "/admin/refunds?period=last_30",
    ]) {
      await mp.goto(`${base}${path}`, { waitUntil: "networkidle" });
      const overflow = await mp.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      check(
        `${path.split("?")[0]} fits a phone`,
        overflow <= 0,
        `overflow ${overflow}px`,
      );
    }
    await mc.close();
  }
  sql("update users set ops_theme = 'dark' where email = 'accounts@local.test'");
  {
    const { page: dp, context: dc } = await session("accounts@local.test");
    await dp.goto(`${base}/admin/refunds?period=last_30`, { waitUntil: "networkidle" });
    await dp.screenshot({ path: `${shots}/refunds-dark.png`, fullPage: true });
    await dc.close();
  }
  sql("update users set ops_theme = 'light' where email = 'accounts@local.test'");
} finally {
  reset();
  sql(
    `update jobs set status = 'unassigned', cancelled_at = null where id = ${WEB.otherJob}`,
  );
  for (const id of Object.keys(OFFICE))
    sql(`update jobs set payment_method = 'cash' where id = ${id}`);
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
