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
const PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj",
    "xref",
    "0 3",
    "0000000000 65535 f ",
    "0000000009 00000 n ",
    "0000000058 00000 n ",
    "trailer<</Size 3/Root 1 0 R>>",
    "startxref",
    "108",
    "%%EOF",
    "",
  ].join("\n"),
);

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
  await context.request.post(`${base}/api/users/login`, {
    data: { email, password: PASSWORD },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push(`${email} ${page.url().replace(base, "")}: ${String(e).slice(0, 140)}`),
  );
  return { context, page };
}
const text = (page) => page.locator("body").innerText();

// A clean slate for the names this test uses (local database only).
sql(
  "delete from vehicles_rels where drivers_id in (select id from drivers where phone in ('+447700900456','+447700900457'))",
);
sql(
  "delete from driver_documents where driver_id in (select id from drivers where phone in ('+447700900456','+447700900457'))",
);
sql(
  "delete from vehicle_documents where vehicle_id in (select id from vehicles where registration='AB12CDE')",
);
sql("delete from vehicles where registration='AB12CDE'");
sql("delete from drivers where phone in ('+447700900456','+447700900457')");
sql(
  "update jobs set supplier_id=null, supplier_reference=null where supplier_id in (select id from suppliers where name='Trip.com')",
);
sql("delete from suppliers where name='Trip.com'");

const owner = await session("owner@local.test");
let page = owner.page;

// --- Drivers -------------------------------------------------------------------
await page.goto(`${base}/admin/drivers`, { waitUntil: "networkidle" });
check("drivers screen opens", /Drivers/.test(await text(page)));
await page.getByRole("link", { name: "Add driver" }).first().click();
await page.waitForURL(/\/admin\/drivers\/new/);
await page.fill("#firstName", "Sam");
await page.fill("#lastName", "Taylor");
await page.fill("#phone", "12345");
await page.getByRole("button", { name: "Add driver" }).click();
await page.getByText("Enter a valid mobile number").waitFor({ timeout: 10_000 });
check("a bad phone number is refused beside the field", true);
await page.fill("#phone", "07700 900456");
check(
  "the driver form asks nothing about pay or employment",
  (await page
    .locator("#payRule, #payFixed, #payPercent, #employmentType, #showPayInMessages")
    .count()) === 0 && !/Self-employed|Employment|Pay rule/.test(await text(page)),
);
await page.check("#whatsappConsent");
await page.click("#carChoice-none");
await page.getByRole("button", { name: "Add driver" }).click();
await page.waitForURL(/\/admin\/drivers\/\d+\?notice=created/, { timeout: 15_000 });
const driverId = Number(page.url().match(/drivers\/(\d+)/)[1]);
let body = await text(page);
check(
  "a new driver has no documents, so assignment is blocked",
  /Assignment blocked/.test(body) && (body.match(/Not on record/g) ?? []).length === 4,
);
check(
  "the phone is stored as +44",
  sql(`select phone from drivers where id=${driverId}`) === "+447700900456",
);

async function addDocument(type, { number = "", expires = "", file = true } = {}) {
  // Start from the record's own page each time, so a redirect from the
  // previous upload cannot be mistaken for this one's.
  const here = page.url().split("?")[0];
  await page.goto(here, { waitUntil: "networkidle" });
  await page.selectOption("#doc-type", type);
  await page.fill("#doc-number", number);
  await page.fill("#doc-expires", expires);
  if (file)
    await page.setInputFiles("#doc-file", {
      name: `${type}.pdf`,
      mimeType: "application/pdf",
      buffer: PDF,
    });
  await page.getByRole("button", { name: "Add document" }).click();
  await page.waitForURL(/notice=document-added/, { timeout: 20_000 });
}

await page.selectOption("#doc-type", "phv_licence");
await page.fill("#doc-expires", day(5));
await page.getByRole("button", { name: "Add document" }).click();
await page.getByText("Enter the PHV licence number").waitFor({ timeout: 10_000 });
check("a PHV licence without its number is refused", true);

await page.selectOption("#doc-type", "phv_licence");
await page.fill("#doc-number", "PHV-123456");
await page.fill("#doc-expires", day(5));
await page.setInputFiles("#doc-file", {
  name: "fake.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("not really a pdf"),
});
await page.getByRole("button", { name: "Add document" }).click();
await page
  .getByText(/could not be accepted/)
  .first()
  .waitFor({ timeout: 15_000 });
check(
  "a corrupt PDF is refused, with the reason beside the field",
  (await page.locator("#doc-number").inputValue()) === "PHV-123456",
);

await addDocument("phv_licence", { number: "PHV-123456", expires: day(5) });
await addDocument("dvla_licence", { number: "TAYLO801015ST9AB", expires: day(700) });
await addDocument("dbs", { number: "001234567890", expires: day(400) });
await addDocument("right_to_work", { file: false });
body = await text(page);
check(
  "with every document on record, the driver is expiring soon, not blocked",
  /Expiring soon/.test(body) && !/Assignment blocked/.test(body),
);
check("the licence due in 5 days is marked Urgent", /Urgent · 5 days/.test(body));

const fileUrl = await page.locator('a:has-text("View")').first().getAttribute("href");
const fileTarget = fileUrl.startsWith("http") ? fileUrl : base + fileUrl;
// Fetched from inside the page, as a click on "View" is: Payload only honours
// the session cookie on requests a browser marks as same-origin.
const ownerFile = await page.evaluate(async (url) => {
  const response = await fetch(url);
  return { status: response.status, type: response.headers.get("content-type") ?? "" };
}, fileTarget);
check(
  "staff can open an uploaded licence scan",
  ownerFile.status === 200 && ownerFile.type.includes("pdf"),
  `status ${ownerFile.status}`,
);
const anonymousFile = await fetch(fileTarget);
check(
  "a visitor cannot open it",
  anonymousFile.status === 403 || anonymousFile.status === 401,
  `status ${anonymousFile.status}`,
);

// Bank details, owner only, sealed.
await page.fill("#accountName", "S Taylor");
await page.fill("#sortCode", "12-34-56");
await page.fill("#accountNumber", "31415926");
await page.getByRole("button", { name: "Save bank details" }).click();
await page.waitForURL(/notice=bank-saved/, { timeout: 15_000 });
check(
  "the owner sees only the last four digits",
  (await page
    .getByText("•••• 5926")
    .waitFor({ timeout: 10_000 })
    .then(() => true)) &&
    !/31415926/.test(await text(page)) &&
    (await page.inputValue("#accountNumber")) === "",
);
const stored = sql(`select bank_details_sealed from drivers where id=${driverId}`);
check(
  "bank details are encrypted in the database",
  stored.startsWith("v1.") &&
    !stored.includes("31415926") &&
    !stored.includes("12-34-56"),
);
await page.screenshot({ path: `${shots}/fleet-driver.png`, fullPage: true });

// Duplicate phone.
await page.goto(`${base}/admin/drivers/new`, { waitUntil: "networkidle" });
await page.fill("#firstName", "Other");
await page.fill("#lastName", "Driver");
await page.fill("#phone", "+44 7700 900456");
await page.click("#carChoice-none");
await page.getByRole("button", { name: "Add driver" }).click();
await page
  .getByText("Another driver already has this number")
  .waitFor({ timeout: 10_000 });
check("the same WhatsApp number cannot belong to two drivers", true);

// --- Vehicles ------------------------------------------------------------------
await page.goto(`${base}/admin/vehicles/new`, { waitUntil: "networkidle" });
await page.fill("#registration", "ab12 cde");
await page.selectOption("#vehicleClassSlug", "saloon");
await page.fill("#make", "Toyota");
await page.fill("#model", "Prius");
await page.fill("#colour", "Black");
await page.fill("#seats", "4");
await page.fill("#drivers", "sam tay");
await page.locator(`[role="option"]`, { hasText: "Sam Taylor" }).first().click();
await page.getByRole("button", { name: "Add car" }).click();
await page.waitForURL(/\/admin\/vehicles\/\d+\?notice=created/, { timeout: 15_000 });
const vehicleId = Number(page.url().match(/vehicles\/(\d+)/)[1]);
check(
  "the registration is stored without spaces, in capitals",
  sql(`select registration from vehicles where id=${vehicleId}`) === "AB12CDE",
);
await addDocument("phv_vehicle_licence", { number: "PHV-V-1", expires: day(300) });
await addDocument("mot", { expires: day(-1) });
await addDocument("insurance", { expires: day(60) });
body = await text(page);
check(
  "an expired MOT blocks the vehicle",
  /Assignment blocked/.test(body) && /Expired/.test(body),
);
check("the vehicle lists its driver", /Sam Taylor/.test(body));

// --- Compliance and the dashboard -------------------------------------------------
await page.goto(`${base}/admin/compliance?tab=vehicles`, { waitUntil: "networkidle" });
body = await text(page);
check(
  "compliance lists the vehicle's expired MOT as blocking",
  /AB12CDE/.test(body) && /MOT certificate/.test(body) && /Assignment blocked/.test(body),
);
await page.screenshot({ path: `${shots}/fleet-compliance.png`, fullPage: true });
await page.goto(`${base}/admin/compliance`, { waitUntil: "networkidle" });
check(
  "compliance lists the driver's licence as urgent",
  /Sam Taylor/.test(await text(page)) && /Urgent/.test(await text(page)),
);
await page.goto(`${base}/admin/dashboard`, { waitUntil: "networkidle" });
body = await text(page);
check(
  "the dashboard raises both documents",
  /AB12CDE: MOT certificate expired — assignment blocked/.test(body) &&
    /Sam Taylor: PHV driver licence expires in/.test(body),
);

// --- Suppliers ------------------------------------------------------------------
await page.goto(`${base}/admin/suppliers/new`, { waitUntil: "networkidle" });
await page.fill("#name", "Trip.com");
check(
  "the supplier form has no commission",
  (await page.locator("#commissionPercent").count()) === 0,
);
await page.getByRole("button", { name: "Add supplier" }).click();
await page.waitForURL(/\/admin\/suppliers\/\d+\?notice=created/, { timeout: 15_000 });
const supplierId = Number(page.url().match(/suppliers\/(\d+)/)[1]);
check(
  "a supplier is saved, and its page mentions no commission",
  !/commission/i.test(await text(page)),
);

// --- Audit log --------------------------------------------------------------------
await page.goto(`${base}/admin/audit`, { waitUntil: "networkidle" });
body = await text(page);
check(
  "the audit log records drivers, documents, vehicles and suppliers",
  /Sam Taylor/.test(body) &&
    /AB12CDE/.test(body) &&
    /Trip\.com/.test(body) &&
    /PHV driver licence/.test(body),
);
check(
  "bank details are logged as changed without their values",
  /\(hidden\)/.test(body) && !/31415926|5926/.test(body),
);
check(
  "the audit log shows yes/no and London dates, not raw values",
  /Yes/.test(body) && !/\d{4}-\d{2}-\d{2}T\d{2}/.test(body),
);
await page.screenshot({ path: `${shots}/fleet-audit.png`, fullPage: true });
await owner.context.close();

// --- Other roles ------------------------------------------------------------------
{
  const { page: cp, context } = await session("controller@local.test");
  await cp.goto(`${base}/admin/drivers/${driverId}`, { waitUntil: "networkidle" });
  check(
    "a controller sees the driver but not the bank details",
    /Sam Taylor/.test(await text(cp)) && !/Bank details/.test(await text(cp)),
  );
  const token = await login("controller@local.test");
  const viaApi = await api(`/api/drivers/${driverId}`, token);
  check(
    "…and the API does not give them the bank fields either",
    viaApi.status === 200 &&
      !("bankDetailsSealed" in viaApi.body) &&
      !("bankAccountLast4" in viaApi.body),
  );
  await cp.goto(`${base}/admin/audit`, { waitUntil: "networkidle" });
  check(
    "a controller cannot open the audit log",
    /do not have access/.test(await text(cp)),
  );
  await context.close();
}
{
  const { page: ap, context } = await session("accounts@local.test");
  await ap.goto(`${base}/admin/drivers`, { waitUntil: "networkidle" });
  check(
    "accounts can see drivers but not add them",
    /Sam Taylor/.test(await text(ap)) &&
      (await ap.getByRole("link", { name: "Add driver" }).count()) === 0,
  );
  await ap.goto(`${base}/admin/drivers/new`, { waitUntil: "networkidle" });
  check("…and the add page refuses them", /do not have access/.test(await text(ap)));
  await context.close();
}
{
  const token = await login("editor@local.test");
  check(
    "an editor gets no driver records from the API",
    (await api("/api/drivers", token)).status === 403,
  );
  const editorFile = await fetch(fileTarget, {
    headers: { Authorization: `JWT ${token}` },
  });
  check(
    "…and cannot open a licence scan",
    editorFile.status === 403,
    `status ${editorFile.status}`,
  );
}

// --- Job rules, enforced by the API itself ----------------------------------------------
{
  const token = await login("controller@local.test");
  const job = (extra) => ({
    reference: `J-T${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
    pickupAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    pickupAddress: "Heathrow Terminal 5",
    dropoffAddress: "Uxbridge",
    vehicleClassSlug: "saloon",
    passengers: 1,
    largeBags: 1,
    smallBags: 0,
    leadName: "Rule Test",
    leadPhone: "+447700900999",
    status: "unassigned",
    customerPricePence: 5000,
    paymentMethod: "supplier",
    isTest: true,
    ...extra,
  });
  const website = await api("/api/jobs", token, {
    method: "POST",
    body: JSON.stringify(job({ source: "website" })),
  });
  check(
    "staff cannot create a website job",
    website.status === 400 && /website checkout only/.test(JSON.stringify(website.body)),
    `status ${website.status}`,
  );

  const first = await api("/api/jobs", token, {
    method: "POST",
    body: JSON.stringify(
      job({ source: "supplier", supplier: supplierId, supplierReference: "trip-100" }),
    ),
  });
  check(
    "a supplier job saves, with its reference normalised",
    first.status === 201 && first.body?.doc?.supplierReference === "TRIP-100",
    `status ${first.status}`,
  );
  const duplicate = await api("/api/jobs", token, {
    method: "POST",
    body: JSON.stringify(
      job({ source: "supplier", supplier: supplierId, supplierReference: " Trip-100 " }),
    ),
  });
  check(
    "the same supplier reference cannot be entered twice",
    duplicate.status === 400 &&
      /already entered as J-/.test(JSON.stringify(duplicate.body)),
    `status ${duplicate.status}`,
  );

  const missingRef = await api("/api/jobs", token, {
    method: "POST",
    body: JSON.stringify(job({ source: "supplier", supplier: supplierId })),
  });
  check("a supplier job needs the supplier's reference", missingRef.status === 400);

  const websiteJobId = sql("select id from jobs where locked = true order by id limit 1");
  const locked = await api(`/api/jobs/${websiteJobId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ customerPricePence: 1 }),
  });
  check(
    "a website job's price cannot be changed by hand",
    locked.status === 400 && /use Amend booking/.test(JSON.stringify(locked.body)),
    `status ${locked.status}`,
  );
  const operational = await api(`/api/jobs/${websiteJobId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ internalNotes: "Checked by the office" }),
  });
  check(
    "…but its operational notes can",
    operational.status === 200,
    `status ${operational.status}`,
  );
  const source = await api(`/api/jobs/${first.body?.doc?.id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ source: "phone" }),
  });
  check("a job's source cannot change", source.status === 400);
}

// --- Phone ------------------------------------------------------------------------
{
  const { page: mp, context } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  for (const path of [
    "/admin/drivers",
    `/admin/drivers/${driverId}`,
    "/admin/vehicles",
    "/admin/compliance",
  ]) {
    await mp.goto(base + path, { waitUntil: "networkidle" });
    const overflow = await mp.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${path} fits a phone`, overflow <= 0, `overflow ${overflow}px`);
  }
  await mp.goto(`${base}/admin/drivers/${driverId}`, { waitUntil: "networkidle" });
  await mp.screenshot({ path: `${shots}/fleet-driver-mobile.png`, fullPage: true });
  await context.close();
}

check(
  "no JavaScript errors anywhere",
  errors.length === 0,
  errors.slice(0, 4).join(" | "),
);
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
