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
const suffix = String(Date.now()).slice(-5);

function cleanUp() {
  const ids = sql(
    "select string_agg(id::text, ',') from drivers where last_name = 'Fleetcheck'",
  );
  if (ids) {
    sql(`delete from vehicles_rels where drivers_id in (${ids})`);
    sql(`delete from drivers where id in (${ids})`);
  }
  const cars = sql(
    "select string_agg(id::text, ',') from vehicles where registration like 'FLT%'",
  );
  if (cars) {
    sql(`delete from vehicles_rels where parent_id in (${cars})`);
    sql(`delete from vehicles where id in (${cars})`);
  }
}
cleanUp();

try {
  const { page, context } = await session("controller@local.test");
  await page.goto(`${base}/admin/drivers`, { waitUntil: "networkidle" });
  const nav = (await page.locator("aside").innerText()).replace(/\s+/g, " ");
  check(
    "drivers and cars are one entry under Fleet",
    /Drivers & cars/.test(nav) && !/\bVehicles\b/.test(nav),
    nav.slice(0, 200),
  );
  check(
    "with a tab each",
    (await page.getByRole("link", { name: "Cars", exact: true }).count()) === 1,
  );

  // A driver added with a new car, in the same form.
  await page.getByRole("link", { name: "Add driver", exact: true }).first().click();
  await page.waitForURL(/\/admin\/drivers\/new$/, { timeout: 30_000 });
  check(
    "a new driver's car is asked for in the same form",
    (await page.isChecked("#carChoice-new")) &&
      (await page.locator("#registration").count()) === 1,
  );
  await page.fill("#firstName", "Nia");
  await page.fill("#lastName", "Fleetcheck");
  await page.fill("#phone", `07700 7${suffix}`);
  await page.getByRole("button", { name: "Add driver" }).click();
  await page.getByText("Enter the registration.").waitFor({ timeout: 20_000 });
  check("the car's details are needed for a new car", true);
  await page.fill("#registration", `FLT1 ${suffix.slice(-3)}`);
  await page.selectOption("#vehicleClassSlug", "estate");
  await page.fill("#make", "Skoda");
  await page.fill("#model", "Enyaq");
  await page.fill("#colour", "Blue");
  await page.getByRole("button", { name: "Add driver" }).click();
  await page.waitForURL(/\/admin\/drivers\/\d+\?notice=created/, { timeout: 30_000 });
  const nia = Number(page.url().match(/drivers\/(\d+)/)[1]);
  const niaCar = Number(
    sql(`select id from vehicles where registration = 'FLT1${suffix.slice(-3)}'`),
  );
  check(
    "the driver and their car are saved together, linked",
    niaCar > 0 &&
      sql(
        `select count(*) from vehicles_rels where parent_id = ${niaCar} and drivers_id = ${nia}`,
      ) === "1",
  );
  const reg1 = `FLT1${suffix.slice(-3)}`;
  check(
    "the driver's page shows their car, with 'Replace their car'",
    (await flat(page)).includes(reg1) &&
      (await page.getByRole("link", { name: "Replace their car" }).count()) === 1,
  );

  // A second driver: no sharing someone else's car — their own, or none yet.
  await page.goto(`${base}/admin/drivers/new`, { waitUntil: "networkidle" });
  check(
    "there is no 'existing car' option: a car is one driver's own",
    (await page.locator("#carChoice-existing").count()) === 0 &&
      (await page.locator("#existingCar").count()) === 0,
  );
  await page.fill("#firstName", "Omar");
  await page.fill("#lastName", "Fleetcheck");
  await page.fill("#phone", `07700 6${suffix}`);
  await page.click('label[for="carChoice-none"]');
  await page.getByRole("button", { name: "Add driver" }).click();
  await page.waitForURL(/\/admin\/drivers\/\d+\?notice=created/, { timeout: 30_000 });
  const omar = Number(page.url().match(/drivers\/(\d+)/)[1]);
  check(
    "a driver can be added before their car, and is offered 'Add their car'",
    /No car on record yet/.test(await flat(page)) &&
      (await page.getByRole("link", { name: "Add their car" }).count()) === 1,
  );

  // The list shows each driver's car, and finds a driver by their car.
  await page.goto(`${base}/admin/drivers?q=enyaq`, { waitUntil: "networkidle" });
  let body = await flat(page);
  check(
    "the drivers list finds a driver by their car",
    body.includes("Nia Fleetcheck") &&
      !body.includes("Omar Fleetcheck") &&
      !body.includes("Priya Shah"),
  );
  check("and shows the car beside them", body.includes(`${reg1} · Skoda Enyaq`));
  await page.screenshot({ path: `${shots}/drivers-and-cars.png`, fullPage: true });

  // 'Add their car' from a driver: one driver, chosen by search; no checkboxes, no ownership.
  await page.goto(`${base}/admin/vehicles/new?driver=${omar}`, {
    waitUntil: "networkidle",
  });
  body = await flat(page);
  check(
    "'Add their car' starts with that driver chosen",
    (await page.inputValue("#drivers")).includes("Omar Fleetcheck"),
    await page.inputValue("#drivers"),
  );
  check(
    "no driver checkboxes and no ownership on the car form",
    (await page.locator('input[type="checkbox"][name="drivers"]').count()) === 0 &&
      !/Ownership|Company/i.test(body),
  );
  await page.fill("#registration", `FLT2 ${suffix.slice(-3)}`);
  await page.selectOption("#vehicleClassSlug", "mpv-5");
  await page.fill("#make", "Ford");
  await page.fill("#model", "S-Max");
  await page.fill("#colour", "Red");
  await page.getByRole("button", { name: "Add car" }).click();
  await page.waitForURL(/\/admin\/vehicles\/\d+\?notice=created/, { timeout: 30_000 });
  const second = Number(page.url().match(/vehicles\/(\d+)/)[1]);
  check(
    "the car is that driver's alone",
    sql(
      `select string_agg(drivers_id::text, ',') from vehicles_rels where parent_id = ${second}`,
    ) === String(omar),
  );
  body = await flat(page);
  check(
    "the car's page names its driver, with no ownership",
    /Omar Fleetcheck/.test(body) && !/Ownership|Company-owned/i.test(body),
  );

  // A driver's new car replaces the old one, which is kept as no longer used.
  await page.goto(`${base}/admin/vehicles/new?driver=${nia}`, {
    waitUntil: "networkidle",
  });
  check(
    "the form says the new car replaces their current one",
    (await flat(page)).includes(
      `Saving marks Nia Fleetcheck's car ${reg1} as no longer used`,
    ),
  );
  await page.fill("#registration", `FLT3 ${suffix.slice(-3)}`);
  await page.selectOption("#vehicleClassSlug", "saloon");
  await page.fill("#make", "Toyota");
  await page.fill("#model", "Prius");
  await page.fill("#colour", "Silver");
  await page.getByRole("button", { name: "Add car" }).click();
  await page.waitForURL(/\/admin\/vehicles\/\d+\?notice=created/, { timeout: 30_000 });
  check(
    "the old car is marked no longer used, still on record",
    sql(`select status from vehicles where id = ${niaCar}`) === "sold",
  );
  await page.goto(`${base}/admin/drivers/${nia}`, { waitUntil: "networkidle" });
  body = await flat(page);
  const reg3 = `FLT3${suffix.slice(-3)}`;
  check(
    "the driver's page shows the new car first and the old one as no longer used",
    body.indexOf(reg3) > -1 &&
      body.indexOf(reg3) < body.indexOf(reg1) &&
      /No longer used/.test(body),
  );

  // Nobody can be given two drivers' car, even through the API.
  const token = (
    await (
      await fetch(`${base}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@local.test", password: PASSWORD }),
      })
    ).json()
  ).token;
  const sharedCar = await fetch(`${base}/api/vehicles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
    body: JSON.stringify({
      registration: `FLT4 ${suffix.slice(-3)}`,
      make: "Kia",
      model: "Niro",
      colour: "White",
      vehicleClassSlug: "saloon",
      seats: 4,
      status: "active",
      drivers: [nia, omar],
    }),
  });
  check(
    "a car for two drivers is refused",
    sharedCar.status === 400 &&
      /A car belongs to one driver only/.test(await sharedCar.text()),
  );

  await page.goto(`${base}/admin/vehicles`, { waitUntil: "networkidle" });
  body = await flat(page);
  check(
    "the cars list sits under the same entry, with its tab",
    /Drivers & cars/.test(body) &&
      (await page.getByRole("link", { name: "Add car" }).count()) >= 1,
  );
  check("the cars list has no ownership column", !/Ownership|Company-owned/i.test(body));
  await context.close();

  // Accounts sees drivers, not cars: no Cars tab.
  const { page: ap, context: ac } = await session("accounts@local.test");
  await ap.goto(`${base}/admin/drivers`, { waitUntil: "networkidle" });
  check(
    "Accounts gets the drivers list without a Cars tab",
    (await ap.getByRole("link", { name: "Cars", exact: true }).count()) === 0 &&
      /Drivers & cars/.test(await flat(ap)),
  );
  await ac.close();

  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  for (const path of ["/admin/drivers", "/admin/drivers/new", "/admin/vehicles/new"]) {
    await mp.goto(`${base}${path}`, { waitUntil: "networkidle" });
    const overflow = await mp.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`${path} fits a phone`, overflow <= 0, `overflow ${overflow}px`);
  }
  await mc.close();
} finally {
  cleanUp();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
