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
const pounds = (pence) =>
  `${pence < 0 ? "-" : ""}£${Math.floor(Math.abs(pence) / 100).toLocaleString("en-GB")}.${String(Math.abs(pence) % 100).padStart(2, "0")}`;
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
const flat = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ");

// --- Fixtures: one of every kind of money movement ------------------------------------
const one = (q) => sql(q).split("\n")[0] ?? "";
const officeJob = Number(
  one(
    "select id from jobs where is_test = false and source = 'phone' and status = 'unassigned' and payment_method = 'cash' and customer_payment_id is null order by id limit 1",
  ),
);
// A completed cash booking: the passenger paid the driver (a PNS has no cash).
const [cashJob, cashDriver] = one(
  "select id || '|' || driver_id from jobs where is_test = false and status in ('no_show', 'completed') and payment_method = 'cash' and driver_id is not null and driver_price_pence is not null and driver_payment_id is null order by id limit 1",
)
  .split("|")
  .map(Number);
const cashStatus = sql(`select status from jobs where id = ${cashJob}`);
const [partnerJob, partner] = one(
  "select id || '|' || supplier_id from jobs where is_test = false and source = 'supplier' and status = 'unassigned' and supplier_payment_id is null and supplier_id is not null order by id limit 1",
)
  .split("|")
  .map(Number);
check(
  "fixtures found",
  officeJob > 0 && cashJob > 0 && partnerJob > 0,
  `${officeJob} ${cashJob} ${partnerJob}`,
);
const price = (id, column = "customer_price_pence") =>
  Number(sql(`select ${column} from jobs where id = ${id}`));
const partnerName = sql(`select name from suppliers where id = ${partner}`);
const start = Object.fromEntries(
  [
    "driver_payments",
    "supplier_payments",
    "customer_payments",
    "refunds",
    "expenses",
  ].map((table) => [table, Number(sql(`select coalesce(max(id), 0) from ${table}`))]),
);
function reset() {
  for (const [table, id] of Object.entries(start))
    sql(`delete from ${table} where id > ${id}`);
  sql(
    `update jobs set payment_method = 'cash', customer_payment_id = null, customer_paid_price_pence = null, payment_fee_pence = 0 where id = ${officeJob}`,
  );
  sql(
    `update jobs set status = '${cashStatus}', driver_payment_id = null, driver_paid_price_pence = null where id = ${cashJob}`,
  );
  sql(
    `update jobs set status = 'unassigned', supplier_payment_id = null where id = ${partnerJob}`,
  );
  sql(
    "update payments set fee_recorded_at = coalesce(fee_recorded_at, now()) where id in (5, 6)",
  );
}

try {
  const token = await login("accounts@local.test");
  const api = async (path, method, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, text: await response.text() };
  };
  const today = new Date().toISOString();
  sql(`update jobs set payment_method = 'bank' where id = ${officeJob}`);
  sql(`update jobs set status = 'completed' where id = ${partnerJob}`);
  sql(`update jobs set status = 'completed' where id = ${cashJob}`);
  const made = [
    await api("/api/customer-payments", "POST", {
      paidAt: today,
      method: "bank_transfer",
      feePence: 30,
      lines: [{ job: officeJob }],
    }),
    await api("/api/driver-payments", "POST", {
      driver: cashDriver,
      upTo: today,
      paidAt: today,
      method: "bank_transfer",
      lines: [{ job: cashJob }],
    }),
    await api("/api/supplier-payments", "POST", {
      supplier: partner,
      receivedAt: today,
      method: "bank_transfer",
      lines: [{ job: partnerJob }],
    }),
    await api("/api/refunds", "POST", {
      payment: 5,
      refundedAt: today,
      reason: "CHECK goodwill",
      amountPence: 1000,
      lines: [{ job: 8, amountPence: 1000 }],
    }),
    await api("/api/expenses", "POST", {
      spentAt: today,
      description: "CHECK printer ink",
      amountPence: 2000,
    }),
    await api("/api/expenses", "POST", {
      spentAt: today,
      description: "CHECK entered twice",
      amountPence: 9999,
    }),
  ];
  check(
    "each kind of money movement is recorded",
    made.every((m) => m.status === 201),
    made
      .map((m) => `${m.status} ${m.status === 201 ? "" : m.text.slice(0, 120)}`)
      .join(" | "),
  );
  const twice = Number(
    sql("select id from expenses where description = 'CHECK entered twice'"),
  );
  await api(`/api/expenses/${twice}`, "PATCH", { voidReason: "CHECK duplicate" });

  // What the report should say, from the records themselves.
  const website = Number(
    sql("select sum(amount_pence) from payments where id in (5, 6)"),
  );
  const websiteFees = Number(
    sql("select sum(fee_pence) from payments where id in (5, 6)"),
  );
  const office = price(officeJob);
  const cash = price(cashJob);
  const driver = price(cashJob, "driver_price_pence");
  const fromPartner = price(partnerJob);
  const moneyIn = website + office + cash + fromPartner;
  const moneyOut = websiteFees + 30 + 1000 + driver + 2000;
  const profit = moneyIn - moneyOut;

  const { page, context } = await session("accounts@local.test");
  await page.goto(`${base}/admin/reports/finance?period=last_30`, {
    waitUntil: "networkidle",
  });
  const nav = await page.locator("aside").innerText();
  check(
    "Financial Reports is open in the menu",
    /Financial Reports/.test(nav) && !/Financial Reports\s*Soon/.test(nav),
  );
  let body = await flat(page);
  check(
    "money in, out and profit add up from every record",
    body.includes(`Money in ${pounds(moneyIn)}`) &&
      body.includes(`Profit ${pounds(profit)}`) &&
      body.includes(`Expenses ${pounds(2000)}`),
    `in ${pounds(moneyIn)}, profit ${pounds(profit)}`,
  );
  check(
    "cash on an office booking counts when it is settled with the driver",
    body.includes(`Cash on office bookings, settled with drivers ${pounds(cash)}`) &&
      body.includes(`Drivers' prices, paid − ${pounds(driver)}`),
  );
  check(
    "a void expense never counts",
    !body.includes("CHECK entered twice") && !body.includes("99.99"),
  );
  check(
    "split by website, office and each partner",
    body.includes(`Website ${pounds(website)} − £10.00 − ${pounds(websiteFees)} —`) &&
      body.includes(`Office ${pounds(office + cash)} — − £0.30 − ${pounds(driver)}`) &&
      body.includes(`${partnerName} ${pounds(fromPartner)}`),
  );
  const ledger = await page
    .locator("section", { hasText: "Every movement of money" })
    .last()
    .locator("tbody tr")
    .count();
  check("every movement of money is a row", ledger === 11, `${ledger} rows`);
  const columns = await page.locator("li[data-tip-value]").count();
  check("the chart has a column for each day", columns === 30, `${columns}`);
  check(
    "no warning while every card fee is known",
    !/no card fee from Stripe yet/.test(body),
  );

  const csvs = await page.evaluate(async () => {
    const all = await fetch("/api/reports/finance?period=last_30");
    const sources = await fetch("/api/reports/finance?period=last_30&data=sources");
    return {
      a: all.status,
      ab: await all.text(),
      s: sources.status,
      sb: await sources.text(),
    };
  });
  const rows = csvs.ab.trim().split(/\r?\n/).slice(1);
  const sum = (index) =>
    Math.round(
      rows.reduce((total, row) => total + Number(row.split(",").at(index) || 0), 0) * 100,
    );
  check(
    "the CSV holds every movement, adding up to the same",
    csvs.a === 200 && rows.length === 11 && sum(-2) === moneyIn && sum(-1) === moneyOut,
    `${rows.length} rows, in ${sum(-2)}, out ${sum(-1)}`,
  );
  check(
    "the by-source CSV has a row each",
    csvs.s === 200 &&
      csvs.sb.includes(partnerName) &&
      csvs.sb.trim().split(/\r?\n/).length === 4,
  );

  sql("update payments set fee_recorded_at = null where id = 6");
  await page.reload({ waitUntil: "networkidle" });
  check(
    "a payment with no fee from Stripe yet is flagged",
    /1 website payment in these dates has no card fee from Stripe yet/.test(
      await flat(page),
    ),
  );
  sql("update payments set fee_recorded_at = now() where id = 6");
  await page.goto(`${base}/admin/reports/finance?period=last_30`, {
    waitUntil: "networkidle",
  });
  await page.screenshot({ path: `${shots}/finance-report.png`, fullPage: true });
  await page.goto(
    `${base}/admin/reports/finance?period=custom&from=2026-01-01&to=2026-12-31`,
    { waitUntil: "networkidle" },
  );
  const months = await page.locator("li[data-tip-value]").count();
  check("a year is shown month by month", months === 12, `${months}`);
  await context.close();

  for (const email of ["controller@local.test", "editor@local.test"]) {
    const { page: other, context: oc } = await session(email);
    await other.goto(`${base}/admin/reports/finance`, { waitUntil: "networkidle" });
    const denied = /You do not have access to this/.test(
      await other.locator("body").innerText(),
    );
    const status = await other.evaluate(
      async () => (await fetch("/api/reports/finance")).status,
    );
    check(`${email.split("@")[0]} cannot see it`, denied && status === 403, `${status}`);
    await oc.close();
  }
  check(
    "signed out, the CSV is refused",
    (await fetch(`${base}/api/reports/finance`)).status === 403,
  );

  {
    const { page: mp, context: mc } = await session("accounts@local.test", {
      width: 390,
      height: 844,
    });
    await mp.goto(`${base}/admin/reports/finance?period=last_30`, {
      waitUntil: "networkidle",
    });
    const overflow = await mp.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    const offenders = await mp.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right <= window.innerWidth + 1 || r.width === 0) continue;
        let clipped = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) {
            clipped = true;
            break;
          }
        }
        if (!clipped)
          out.push(
            `${el.tagName}.${String(el.className).slice(0, 60)} r=${Math.round(r.right)}`,
          );
      }
      return out.slice(0, 6).join(" | ");
    });
    check("fits a phone", overflow <= 0, `overflow ${overflow}px ${offenders}`);
    await mc.close();
  }
  sql("update users set ops_theme = 'dark' where email = 'owner@local.test'");
  {
    const { page: dp, context: dc } = await session("owner@local.test");
    await dp.goto(`${base}/admin/reports/finance?period=last_30`, {
      waitUntil: "networkidle",
    });
    check(
      "the Owner sees it too",
      /Every movement of money/.test(await dp.locator("body").innerText()),
    );
    await dp.screenshot({ path: `${shots}/finance-report-dark.png`, fullPage: true });
    await dc.close();
  }
  sql("update users set ops_theme = 'light' where email = 'owner@local.test'");
} finally {
  reset();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
