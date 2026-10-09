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
const text = (page) => page.locator("body").innerText();
const cleanUp = () => sql("delete from expenses where description like 'CHECK %'");
cleanUp();

// --- The Controller enters one --------------------------------------------------------
const { page: cp, context: cc } = await session("controller@local.test");
await cp.goto(`${base}/admin/expenses`, { waitUntil: "networkidle" });
const nav = await cp.locator("aside").innerText();
check(
  "the Controller sees Expenses under Finance, and no other money screen",
  /Expenses/.test(nav) && !/Driver Pay/.test(nav) && !/Supplier Money/.test(nav),
);
await cp.getByRole("button", { name: "Add expense" }).click();
await cp.getByText("Write what it was for.").waitFor({ timeout: 10_000 });
check(
  "an expense needs what it was for and an amount",
  /Enter the amount in pounds/.test(await text(cp)),
);
await cp.fill("#description", "CHECK Office printer paper");
await cp.fill("#amount", "49.99");
await cp.fill("#paidTo", "Ryman");
await cp.selectOption("#method", "card");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
await cp.setInputFiles("#receipt", {
  name: "receipt.png",
  mimeType: "image/png",
  buffer: png,
});
await cp.getByRole("button", { name: "Add expense" }).click();
await cp.waitForURL(/notice=added/, { timeout: 20_000 });
let body = await text(cp);
check(
  "the expense is saved with its receipt, as a private file",
  sql(
    "select amount_pence || ' ' || paid_to || ' ' || method from expenses where description = 'CHECK Office printer paper'",
  ) === "4999 Ryman card" &&
    sql(
      "select f.purpose from expenses e join private_files f on f.id = e.receipt_id where e.description = 'CHECK Office printer paper'",
    ) === "receipt" &&
    /CHECK Office printer paper/.test(body) &&
    (await cp.getByRole("link", { name: "Receipt" }).count()) >= 1,
);
check(
  "the form starts empty for the next one",
  (await cp.inputValue("#description")) === "" && (await cp.inputValue("#amount")) === "",
);
await cp.goto(`${base}/admin/dashboard`, { waitUntil: "networkidle" });
check(
  "the Controller does not see the money rings",
  !/Money in and out/.test(await text(cp)),
);
await cc.close();

// --- Accounts enters another, and voids one ------------------------------------------
const { page, context } = await session("accounts@local.test");
await page.goto(`${base}/admin/expenses`, { waitUntil: "networkidle" });
await page.fill("#description", "CHECK Phone line");
await page.fill("#amount", "25");
await page.getByRole("button", { name: "Add expense" }).click();
await page.waitForURL(/notice=added/, { timeout: 20_000 });
body = await text(page);
check(
  "Accounts sees both, and the total spent",
  /CHECK Office printer paper/.test(body) &&
    /CHECK Phone line/.test(body) &&
    /entered by Carl Controller/.test(body),
);
const accountsToken = await login("accounts@local.test");
const paperId = Number(
  sql("select id from expenses where description = 'CHECK Office printer paper'"),
);
const edit = await fetch(`${base}/api/expenses/${paperId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `JWT ${accountsToken}` },
  body: JSON.stringify({ amountPence: 1 }),
});
check("an expense cannot be edited", edit.status === 400);
const remove = await fetch(`${base}/api/expenses/${paperId}`, {
  method: "DELETE",
  headers: { Authorization: `JWT ${accountsToken}` },
});
check(
  "nor deleted",
  remove.status === 403 || remove.status === 405,
  `status ${remove.status}`,
);

// The rings take expenses off profit.
const from = day(-29);
const to = day(0);
const inRange = `is_test = false and (pickup_at at time zone 'Europe/London')::date between '${from}' and '${to}'`;
const done = `status in ('completed','no_show')`;
const earning = `(${done} or (source = 'supplier' and status = 'cancelled' and cancellation_charge = 'charged'))`;
const n = (q) => Number(sql(q) || 0);
const income = n(
  `select coalesce(sum(customer_price_pence),0) from jobs where ${inRange} and ${earning}`,
);
const fees = n(
  `select coalesce(sum(payment_fee_pence),0) from jobs where ${inRange} and ${earning}`,
);
const drivers = n(
  `select coalesce(sum(driver_price_pence),0) from jobs where ${inRange} and ${done} and driver_price_pence is not null`,
);
const expenses = n(
  `select coalesce(sum(amount_pence),0) from expenses where voided_at is null and (spent_at at time zone 'Europe/London')::date between '${from}' and '${to}'`,
);
const profit = income - drivers - fees - expenses;
await page.goto(`${base}/admin/dashboard?period=last_30`, { waitUntil: "networkidle" });
const rings = (
  await page.locator("section", { hasText: "Money in and out" }).first().innerText()
).replace(/\s+/g, " ");
check(
  "profit on the dashboard takes off the expenses",
  rings.includes(`${pounds(expenses)} expenses`) &&
    rings.includes(`${profit < 0 ? "Loss" : "Profit"} ${pounds(profit)}`),
  `expenses ${pounds(expenses)}, profit ${pounds(profit)} — ${rings.slice(rings.indexOf("Profit"), rings.indexOf("Profit") + 160)}`,
);

await page.goto(`${base}/admin/expenses`, { waitUntil: "networkidle" });
await page
  .locator("li", { hasText: "CHECK Phone line" })
  .getByRole("button", { name: "Void" })
  .click();
await page.locator("dialog[open] textarea").fill("Entered twice");
await page.locator("dialog[open]").getByRole("button", { name: "Void expense" }).click();
await page.getByText("Void: Entered twice").waitFor({ timeout: 15_000 });
check(
  "a void stays on record and stops counting",
  sql(
    "select voided_at is not null from expenses where description = 'CHECK Phone line'",
  ) === "t" && /· £49\.99 \(void ones not counted\)/.test(await text(page)),
);
const csv = await page.evaluate(async () => {
  const response = await fetch("/api/reports/expenses");
  return { status: response.status, body: await response.text() };
});
check(
  "the CSV lists each expense, voids marked",
  csv.status === 200 &&
    csv.body.includes("CHECK Office printer paper") &&
    csv.body.includes("Yes: Entered twice") &&
    csv.body.includes("Amount (£)"),
);
await page.screenshot({ path: `${shots}/expenses.png`, fullPage: true });
await context.close();

// --- Who may not -----------------------------------------------------------------------
{
  const { page: ep, context: ec } = await session("editor@local.test");
  await ep.goto(`${base}/admin/expenses`, { waitUntil: "networkidle" });
  const status = await ep.evaluate(
    async () => (await fetch("/api/reports/expenses")).status,
  );
  check(
    "the editor cannot see expenses",
    /You do not have access to this/.test(await text(ep)) && status === 403,
  );
  await ec.close();
}
check(
  "signed out, the CSV is refused",
  (await fetch(`${base}/api/reports/expenses`)).status === 403,
);

// --- Phone and dark ----------------------------------------------------------------------
{
  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}/admin/expenses`, { waitUntil: "networkidle" });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check("fits a phone", overflow <= 0, `overflow ${overflow}px`);
  await mc.close();
}
sql("update users set ops_theme = 'dark' where email = 'accounts@local.test'");
{
  const { page: dp, context: dc } = await session("accounts@local.test");
  await dp.goto(`${base}/admin/expenses`, { waitUntil: "networkidle" });
  await dp.screenshot({ path: `${shots}/expenses-dark.png`, fullPage: true });
  await dc.close();
}
sql("update users set ops_theme = 'light' where email = 'accounts@local.test'");

cleanUp();
check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
