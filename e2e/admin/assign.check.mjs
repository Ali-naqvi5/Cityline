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
const ahead = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const flat = async (page) =>
  (await page.locator("body").innerText()).replace(/\s+/g, " ");

// Two open bookings, put back exactly as they were afterwards.
const jobs = sql(
  "select id from jobs where is_test = false and status = 'unassigned' and driver_id is null and pickup_at > now() order by pickup_at limit 2",
)
  .split(/\s+/)
  .map(Number);
const saved = jobs.map((id) =>
  sql(
    `select vehicle_class_slug || '|' || passengers || '|' || notify_passenger from jobs where id = ${id}`,
  ),
);
const sam = Number(sql("select id from drivers where full_name = 'Sam Taylor'"));
const carsOf = (id) =>
  sql(
    `select coalesce(string_agg(v.id::text || ':' || v.status, ',' order by v.id), '') from vehicles v join vehicles_rels r on r.parent_id = v.id and r.path = 'drivers' where r.drivers_id = ${id}`,
  );
const samCars = carsOf(sam);
// Sam's car in use, whichever the other checks left him with.
const samReg = sql(
  `select v.registration from vehicles v join vehicles_rels r on r.parent_id = v.id and r.path = 'drivers' where r.drivers_id = ${sam} and v.status <> 'sold' order by v.status = 'active' desc, v.id limit 1`,
);
function cleanUp() {
  for (const [index, id] of jobs.entries()) {
    const [cls, pax, notify] = saved[index].split("|");
    sql(
      `update jobs set driver_id = null, vehicle_id = null, status = 'unassigned', driver_phv_no = null, vehicle_reg = null, dispatched_by_user_id = null, dispatched_at = null, driver_message_status = 'not_sent', driver_price_pence = null, vehicle_class_slug = '${cls}', passengers = ${pax}, notify_passenger = ${notify} where id = ${id}`,
    );
  }
  const cars = sql(
    "select string_agg(id::text, ',') from vehicles where registration like 'CHK%'",
  );
  if (cars) {
    sql(`delete from vehicle_documents where vehicle_id in (${cars})`);
    sql(`delete from vehicles_rels where parent_id in (${cars})`);
    sql(`delete from vehicles where id in (${cars})`);
  }
  const drivers = sql(
    "select string_agg(id::text, ',') from drivers where last_name = 'Assigncheck'",
  );
  if (drivers) {
    sql(`delete from driver_documents where driver_id in (${drivers})`);
    sql(`delete from vehicles_rels where drivers_id in (${drivers})`);
    sql(`delete from drivers where id in (${drivers})`);
  }
}
cleanUp();

try {
  const login = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@local.test", password: PASSWORD }),
  });
  const token = (await login.json()).token;
  const call = async (method, path, body) =>
    (
      await fetch(`${base}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
        body: JSON.stringify(body),
      })
    ).json();
  const api = (path, body) => call("POST", path, body);

  // Four self-employed drivers: three with their own car, one with none yet.
  const suffix = String(Date.now()).slice(-5);
  const driver = async (firstName, index) => {
    const doc = (
      await api("/api/drivers", {
        firstName,
        lastName: "Assigncheck",
        phone: `07700 8${suffix}${index}`,
        engagement: "outsourced",
        status: "active",
      })
    ).doc;
    for (const type of ["phv_licence", "dvla_licence"]) {
      await api("/api/driver-documents", {
        driver: doc.id,
        type,
        number: `${type}-${index}`,
        expiresAt: ahead(400),
      });
    }
    return doc;
  };
  const vera = await driver("Vera", 1);
  const oscar = await driver("Oscar", 2);
  const cora = await driver("Cora", 3);
  await driver("Nadia", 4);
  const car = async (body, owner) =>
    (await api("/api/vehicles", { ...body, drivers: [owner.id] })).doc;
  const mpv = await car(
    {
      registration: "CHK8 MPV",
      make: "Mercedes",
      model: "Vito",
      colour: "Black",
      vehicleClassSlug: "mpv-8",
      seats: 8,
      status: "active",
    },
    vera,
  );
  const off = await car(
    {
      registration: "CHK0 OFF",
      make: "Ford",
      model: "Galaxy",
      colour: "Grey",
      vehicleClassSlug: "mpv-5",
      seats: 5,
      status: "off_road",
    },
    oscar,
  );
  const small = await car(
    {
      registration: "CHK4 SAL",
      make: "Toyota",
      model: "Corolla",
      colour: "White",
      vehicleClassSlug: "saloon",
      seats: 4,
      status: "active",
    },
    cora,
  );
  for (const vehicle of [mpv, off, small]) {
    for (const [type, number] of [
      ["phv_vehicle_licence", "V1"],
      ["mot", null],
      ["insurance", null],
    ]) {
      await api("/api/vehicle-documents", {
        vehicle: vehicle.id,
        type,
        number,
        expiresAt: ahead(300),
      });
    }
  }

  const { page, context } = await session("controller@local.test");
  await page.goto(`${base}/admin/jobs/${jobs[0]}/assign`, { waitUntil: "networkidle" });
  const rows = page.locator('ul[aria-label="Drivers"] > li');
  const working = Number(sql("select count(*) from drivers where status <> 'left'"));
  check(
    "one row per driver, each with their own car",
    (await rows.count()) === working && (await flat(page)).includes("CHK8MPV"),
    `${await rows.count()} rows, ${working} drivers`,
  );
  check(
    "there is no car picker: the car comes with the driver",
    (await page.locator("#assign-car").count()) === 0 &&
      (await page.locator("#assign-driver").count()) === 0,
  );

  const search = async (text) => {
    await page.fill("#assign-search", text);
    return (await rows.first().innerText()).replace(/\s+/g, " ");
  };
  check("a name finds the driver", (await search("priya")).startsWith("Priya Shah"));
  check("a typo still finds them", (await search("tylor")).startsWith("Sam Taylor"));
  check(
    "part of a registration finds the driver whose car it is",
    (await search(samReg.slice(0, 4).toLowerCase())).includes(samReg),
    samReg,
  );
  check(
    "a model finds the car's driver",
    (await search("vito")).startsWith("Vera Assigncheck") &&
      (await search("vito")).includes("CHK8MPV"),
  );
  check(
    "a whole registration with a space comes first",
    (await search(`${samReg.slice(0, 4)} ${samReg.slice(4)}`)).includes(samReg),
  );
  if (samReg !== "AB12CDE") {
    await page.fill("#assign-search", "AB12 CDE");
    const shown = await page
      .locator('ul[aria-label="Drivers"]')
      .innerText()
      .catch(() => "");
    check("a car no longer used is not offered", !shown.includes("AB12CDE"));
  }

  // Vera and her eight-seater: a bigger class — a warning only.
  await search("vera");
  await rows.first().locator("button").click();
  let body = await flat(page);
  check(
    "choosing a driver brings their car, and what differs is a warning",
    /Assign Vera Assigncheck with their car CHK8MPV/.test(body) &&
      /A bigger car than booked/.test(body),
    body.match(/Assign [^.]*\./)?.[0],
  );
  check(
    "nothing suggests a car that is someone else's",
    !/not one the driver normally uses/.test(body),
  );
  if (await page.locator("#notifyPassenger").count())
    await page.uncheck("#notifyPassenger");
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await page.waitForURL(/notice=assigned/, { timeout: 30_000 });
  check(
    "it is assigned with her car",
    sql(
      `select driver_id || ':' || vehicle_id || ':' || vehicle_reg from jobs where id = ${jobs[0]}`,
    ) === `${vera.id}:${mpv.id}:CHK8MPV`,
  );

  // A saloon on an eight-seat booking for six: different class, too few seats.
  sql(
    `update jobs set vehicle_class_slug = 'mpv-8', passengers = 6 where id = ${jobs[1]}`,
  );
  await page.goto(`${base}/admin/jobs/${jobs[1]}/assign`, { waitUntil: "networkidle" });
  await search("cora");
  await rows.first().locator("button").click();
  body = await flat(page);
  check(
    "a smaller car than booked is allowed, with the reasons to check",
    /Booked as [^;]+; this car is Saloon/.test(body) &&
      /4 passenger seats for 6 passengers/.test(body),
  );

  // A driver whose car is off the road cannot go — shown, and refused by the server too.
  await search("oscar");
  await rows.first().locator("button").click();
  body = await flat(page);
  check(
    "a driver whose car is off the road is shown as unable to go, with why",
    /The car is off road, not active/.test(body) && /Cannot go/.test(body),
  );
  if (await page.locator("#notifyPassenger").count())
    await page.uncheck("#notifyPassenger");
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await page.getByText(/cannot do this job/).waitFor({ timeout: 30_000 });
  check(
    "the server refuses it as well",
    sql(`select driver_id is null from jobs where id = ${jobs[1]}`) === "t",
  );

  // A driver with no car on record cannot be given a job.
  await search("nadia");
  await rows.first().locator("button").click();
  body = await flat(page);
  check(
    "a driver with no car is stopped, with what to do",
    /No car on record — add their car on the driver's page/.test(body),
  );

  // Someone else's car is refused by the server, whatever sends it.
  const refused = await call("PATCH", `/api/jobs/${jobs[1]}`, {
    driver: sam,
    vehicle: small.id,
    status: "assigned",
  });
  check(
    "the server refuses a car that is not the driver's own",
    JSON.stringify(refused).includes("That car is not this driver's own.") &&
      sql(`select driver_id is null from jobs where id = ${jobs[1]}`) === "t",
    JSON.stringify(refused).slice(0, 240),
  );

  await search("cora");
  await rows.first().locator("button").click();
  await page.getByRole("button", { name: "Confirm assignment" }).click();
  await page.waitForURL(/notice=assigned/, { timeout: 30_000 }).catch(async () => {
    await page.screenshot({ path: `${shots}/assign-debug.png`, fullPage: true });
  });
  check(
    "the driver with the smaller car is assigned once chosen",
    sql(`select driver_id || ':' || vehicle_id from jobs where id = ${jobs[1]}`) ===
      `${cora.id}:${small.id}`,
  );
  await page.goto(`${base}/admin/jobs/${jobs[1]}/assign`, { waitUntil: "networkidle" });
  const current = await page.locator('[aria-current="page"]').allInnerTexts();
  check(
    "the assign page sits under Bookings now Dispatch is gone",
    current.some((text) => text.includes("Bookings")),
    current.join(" | "),
  );
  await page.screenshot({ path: `${shots}/assign.png`, fullPage: true });
  await context.close();

  const { page: mp, context: mc } = await session("controller@local.test", {
    width: 390,
    height: 844,
  });
  await mp.goto(`${base}/admin/jobs/${jobs[0]}/assign`, { waitUntil: "networkidle" });
  const overflow = await mp.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check("fits a phone", overflow <= 0, `overflow ${overflow}px`);
  await mc.close();
} finally {
  cleanUp();
  const after = carsOf(sam);
  check("Sam's own cars are untouched", after === samCars, `${samCars} → ${after}`);
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
