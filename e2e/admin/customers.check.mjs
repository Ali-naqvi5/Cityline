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

// Clean slate (local database only).
const PHONES = "('+447700900800','+447700900801')";
sql(
  `delete from job_events where job_id in (select id from jobs where lead_phone in ${PHONES})`,
);
sql(`delete from jobs where lead_phone in ${PHONES}`);
sql(`delete from customers where phone in ${PHONES}`);
sql("delete from customers where email = 'regular@example.com'");
sql("update users set ops_theme = 'light'");

const { page, context } = await session("controller@local.test");

async function phoneBooking({
  name,
  phone = "07700 900800",
  date = day(2),
  source = "phone",
}) {
  await page.goto(`${base}/admin/jobs/new`, { waitUntil: "networkidle" });
  await page.selectOption("#source", source);
  if (source === "supplier") {
    await page.selectOption("#supplier", { index: 1 });
    await page.fill("#supplierReference", `CUS-${Date.now()}`);
  }
  await page.fill("#pickupDate", date);
  await page.fill("#pickupTime", "09:00");
  await page.fill("#pickupAddress", "Heathrow Terminal 3");
  await page.fill("#dropoffAddress", "Wembley Park");
  await page.click(`label[for="vehicleClassSlug-saloon"]`);
  await page.fill("#passengers", "1");
  await page.fill("#leadName", name);
  await page.fill("#leadPhone", phone);
  await page.fill("#price", "45");
  if (source !== "supplier") await page.selectOption("#paymentMethod", "cash");
  await page.getByRole("button", { name: "Create booking" }).click();
  await page.waitForURL(/notice=created|This may already/, { timeout: 20_000 });
  if (await page.getByRole("button", { name: /save anyway/ }).count()) {
    await page.getByRole("button", { name: /save anyway/ }).click();
    await page.waitForURL(/notice=created/, { timeout: 20_000 });
  }
  return Number(page.url().match(/jobs\/(\d+)/)[1]);
}

// --- Office bookings record their customer -----------------------------------------
const first = await phoneBooking({ name: "Regular Customer" });
const customerId = Number(sql(`select customer_id from jobs where id=${first}`));
check(
  "a phone booking records its customer, with no email needed",
  customerId > 0 &&
    sql(
      `select name || '|' || phone || '|' || coalesce(email,'-') from customers where id=${customerId}`,
    ) === "Regular Customer|+447700900800|-",
);
check(
  "the booking page links to the customer",
  (await page.getByRole("link", { name: "Regular Customer" }).count()) > 0,
);
const second = await phoneBooking({ name: "regular  customer", date: day(4) });
check(
  "a second booking with the same phone and name joins the same customer",
  Number(sql(`select customer_id from jobs where id=${second}`)) === customerId,
);
const other = await phoneBooking({ name: "Another Person", date: day(5) });
const otherCustomer = Number(sql(`select customer_id from jobs where id=${other}`));
check(
  "a different name on the same phone is a different customer",
  otherCustomer > 0 && otherCustomer !== customerId,
);
const supplierJob = await phoneBooking({
  name: "Supplier Guest",
  phone: "07700 900801",
  source: "supplier",
});
check(
  "a supplier's passenger is not recorded as a Cityline customer",
  sql(`select coalesce(customer_id::text,'none') from jobs where id=${supplierJob}`) ===
    "none",
);

// --- The list ---------------------------------------------------------------------
await page.goto(`${base}/admin/customers?q=900800`, { waitUntil: "networkidle" });
let body = await text(page);
check(
  "searching by phone finds both customers on that number",
  /Regular Customer/.test(body) && /Another Person/.test(body),
);
check(
  "the list counts each customer's bookings",
  (await page.locator("tr", { hasText: "Regular Customer" }).innerText()).includes("2"),
);
await page.screenshot({ path: `${shots}/customers-list.png`, fullPage: true });

// --- The customer page --------------------------------------------------------------
await page.goto(`${base}/admin/customers/${customerId}`, { waitUntil: "networkidle" });
body = await text(page);
check(
  "the customer page shows their bookings and figures",
  /Regular Customer/.test(body) &&
    /Bookings\s*2/.test(body) &&
    /Upcoming\s*2/.test(body) &&
    /£90\.00/.test(body) &&
    /No email — books by phone/.test(body),
);
check(
  "it offers Call and WhatsApp",
  (await page
    .getByRole("link", { name: "Call Regular Customer" })
    .getAttribute("href")) === "tel:+447700900800" &&
    (await page
      .getByRole("link", { name: "WhatsApp Regular Customer" })
      .getAttribute("href")) === "https://wa.me/447700900800",
);

await page.getByRole("link", { name: "Edit" }).first().click();
await page.waitForURL(/\/edit$/);
await page.fill("#email", "Regular@Example.com");
await page.fill("#notes", "Always needs a child seat");
await page.getByRole("button", { name: "Save changes" }).click();
await page.waitForURL(/notice=saved/, { timeout: 15_000 });
body = await text(page);
check(
  "staff can add an email and office notes",
  /regular@example\.com/.test(body) && /Always needs a child seat/.test(body),
);

await page.goto(`${base}/admin/customers/new`, { waitUntil: "networkidle" });
await page.fill("#name", "Someone Else");
await page.fill("#phone", "07700 900999");
await page.fill("#email", "regular@example.com");
await page.getByRole("button", { name: "Add customer" }).click();
await page
  .getByText("Regular Customer already has this email.")
  .waitFor({ timeout: 10_000 });
check("an email already on another customer is refused, naming them", true);
await page.fill("#email", "");
await page.fill("#name", "Regular Customer");
await page.fill("#phone", "07700 900800");
await page.getByRole("button", { name: "Add customer" }).click();
await page.getByText("Regular Customer is already recorded with this phone.").waitFor({
  timeout: 10_000,
});
check("the same name on the same phone is refused as a duplicate", true);

await page.goto(`${base}/admin/customers/${customerId}`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "New booking" }).click();
await page.waitForURL(/customer=/);
check(
  "New booking starts with the customer's name, phone and email",
  (await page.inputValue("#leadName")) === "Regular Customer" &&
    (await page.inputValue("#leadPhone")) === "+447700900800" &&
    (await page.inputValue("#leadEmail")) === "regular@example.com",
);

sql(
  `update customers set marketing_consent = true, marketing_consent_at = now() where id=${customerId}`,
);
await page.goto(`${base}/admin/customers/${customerId}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Withdraw marketing consent" }).click();
await page
  .locator("dialog[open]")
  .getByRole("button", { name: "Withdraw consent" })
  .click();
await page.waitForURL(/notice=consent-withdrawn/, { timeout: 15_000 });
check(
  "marketing consent can be withdrawn when the customer asks",
  sql(`select marketing_consent from customers where id=${customerId}`) === "f",
);
await page.screenshot({ path: `${shots}/customer-page.png`, fullPage: true });

// --- Dark mode ------------------------------------------------------------------------
await page.goto(`${base}/admin/settings`, { waitUntil: "networkidle" });
check(
  "a controller can open Settings and sees Appearance only",
  /Appearance/.test(await text(page)) && !/Card payments/.test(await text(page)),
);
await page.getByRole("radio", { name: /^Dark / }).check();
await page.waitForURL(/notice=theme/, { timeout: 15_000 });
const canvas = await page.evaluate(
  () =>
    getComputedStyle(document.querySelector(".ops-root[data-ops-theme]")).backgroundColor,
);
const cookies = await context.cookies();
check(
  "choosing Dark turns the screens dark and tells Payload's own screens too",
  canvas === "rgb(11, 19, 15)" &&
    sql("select ops_theme from users where email='controller@local.test'") === "dark" &&
    cookies.some((cookie) => cookie.name === "payload-theme" && cookie.value === "dark"),
  canvas,
);
await page.goto(`${base}/admin/bookings?when=all`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${shots}/dark-bookings.png` });
await page.goto(`${base}/admin/jobs/${first}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${shots}/dark-booking.png`, fullPage: true });
await page.goto(`${base}/admin/dashboard`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${shots}/dark-dashboard.png` });
{
  const other = await session("owner@local.test");
  await other.page.goto(`${base}/admin/bookings`, { waitUntil: "networkidle" });
  const ownerCanvas = await other.page.evaluate(
    () =>
      getComputedStyle(document.querySelector(".ops-root[data-ops-theme]"))
        .backgroundColor,
  );
  check(
    "one person's choice does not change anyone else's screen",
    ownerCanvas === "rgb(243, 247, 244)",
    ownerCanvas,
  );
  await other.page.goto(`${base}/admin/settings`, { waitUntil: "networkidle" });
  check(
    "the owner still sees the system settings",
    /Card payments/.test(await text(other.page)),
  );
  await other.context.close();
}
await page.goto(`${base}/admin/settings`, { waitUntil: "networkidle" });
await page.getByRole("radio", { name: /^Light / }).check();
await page.waitForURL(/notice=theme/, { timeout: 15_000 });
check(
  "and back to Light",
  sql("select ops_theme from users where email='controller@local.test'") === "light",
);
await context.close();

// --- Other roles ------------------------------------------------------------------------
{
  const { page: ap, context: ac } = await session("accounts@local.test");
  await ap.goto(`${base}/admin/customers/${customerId}`, { waitUntil: "networkidle" });
  body = await text(ap);
  check(
    "accounts can see a customer but not change them",
    /Regular Customer/.test(body) &&
      !(await ap.getByRole("link", { name: "Edit" }).count()) &&
      !(await ap.getByRole("button", { name: /Withdraw/ }).count()),
  );
  await ap.goto(`${base}/admin/customers/new`, { waitUntil: "networkidle" });
  check(
    "accounts cannot add customers",
    /You do not have access to this/.test(await text(ap)),
  );
  await ac.close();
}
{
  const { page: ep, context: ec } = await session("editor@local.test");
  await ep.goto(`${base}/admin/customers`, { waitUntil: "networkidle" });
  check(
    "an editor cannot see customers",
    /You do not have access to this/.test(await text(ep)),
  );
  await ep.goto(`${base}/admin/settings`, { waitUntil: "networkidle" });
  check("an editor can still choose their appearance", /Appearance/.test(await text(ep)));
  await ec.close();
}

// --- Phones ---------------------------------------------------------------------------
{
  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  for (const path of [
    "/admin/customers",
    `/admin/customers/${customerId}`,
    "/admin/settings",
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
