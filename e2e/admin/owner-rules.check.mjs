import "./local-only.mjs";
import { execFileSync } from "node:child_process";
import { createHmac, hkdfSync } from "node:crypto";

import { chromium } from "@playwright/test";

/**
 * The Owner's rules (Cityline, 13 Oct 2026): a completed or PNS booking is the
 * Owner's to change; a website booking is the Owner's to delete, before any
 * journey on it is done. Also: the driver's payment statement downloads.
 * Everything it changes in the local database is put back at the end.
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
const browser = await chromium.launch();
const errors = [];
async function session(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
  (await page.locator("main").innerText()).replace(/\s+/g, " ");
async function token(email) {
  const response = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  return (await response.json()).token;
}
const patch = async (jwt, id, body) => {
  const response = await fetch(`${base}/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `JWT ${jwt}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
};

// --- Fixtures, and how to put them back ------------------------------------------------
const done = Number(
  sql(
    "select id from jobs where status = 'completed' and archived_at is null order by id desc limit 1",
  ),
);
const doneSaved = sql(
  `select pickup_address || '|' || coalesce(driver_price_pence::text, '') from jobs where id = ${done}`,
);
const bookingId = Number(
  sql(
    "select b.id from bookings b where b.status = 'confirmed' and b.archived_at is null and not exists (select 1 from jobs j where j.booking_id = b.id and j.status in ('completed','no_show','on_board','cancelled')) and not exists (select 1 from payments p where p.booking_id = b.id and p.id in (5, 6)) and not exists (select 1 from jobs j where j.booking_id = b.id and j.id = 8) order by b.id limit 1",
  ),
);
const legs = sql(
  `select string_agg(id::text, ',' order by pickup_at) from jobs where booking_id = ${bookingId}`,
);
const legsSaved = sql(
  `select string_agg(id || '|' || status || '|' || coalesce(cancel_reason, ''), ';' order by id) from jobs where booking_id = ${bookingId}`,
);
const bookingRef = sql(`select reference from bookings where id = ${bookingId}`);
const firstLeg = Number(legs.split(",")[0]);
function restore() {
  const [address, price] = doneSaved.split("|");
  sql(
    `update jobs set pickup_address = '${address.replace(/'/g, "''")}', driver_price_pence = ${price || "null"} where id = ${done}`,
  );
  sql(
    `delete from job_events where job_id = ${done} and created_at > now() - interval '1 hour' and field in ('pickupAddress', 'driverPricePence')`,
  );
  for (const row of legsSaved.split(";")) {
    const [id, status, reason] = row.split("|");
    sql(
      `update jobs set status = '${status}', cancel_reason = ${reason ? `'${reason.replace(/'/g, "''")}'` : "null"}, cancelled_at = null, archived_at = null where id = ${id}`,
    );
    sql(
      `delete from job_events where job_id = ${id} and created_at > now() - interval '1 hour' and (field = 'deleted' or new_value = 'cancelled')`,
    );
  }
  sql(
    `update bookings set status = 'confirmed', cancelled_at = null, cancel_reason = null, archived_at = null where id = ${bookingId}`,
  );
}

try {
  check(
    "fixtures found",
    done > 0 && bookingId > 0 && firstLeg > 0,
    `done ${done}, booking ${bookingId} (${bookingRef}), legs ${legs}`,
  );
  const controller = await token("controller@local.test");
  const owner = await token("owner@local.test");

  // --- A completed booking is the Owner's to change ----------------------------------
  let res = await patch(controller, done, { pickupAddress: "Somewhere else" });
  check(
    "a Controller cannot change a completed booking's details, even through the API",
    res.status === 400 && /Only the Owner can change a completed booking/.test(res.text),
    `status ${res.status}`,
  );
  res = await patch(controller, done, { status: "on_board" });
  check(
    "…nor step it back",
    res.status === 400 && /Only the Owner/.test(res.text),
    `status ${res.status}`,
  );
  const price = Number(doneSaved.split("|")[1] || 0);
  res = await patch(controller, done, { driverPricePence: price + 100 });
  check(
    "…but can still write its driver price",
    res.status === 200,
    `status ${res.status}`,
  );

  {
    const { page, context } = await session("controller@local.test");
    await page.goto(`${base}/admin/jobs/${done}`, { waitUntil: "networkidle" });
    check(
      "the Controller's booking page offers no Edit or step back, and says why",
      !(await page.getByRole("link", { name: "Edit", exact: true }).count()) &&
        /Completed: only the Owner can change it now/.test(await flat(page)),
    );
    await page.goto(`${base}/admin/jobs/${done}/edit`, { waitUntil: "networkidle" });
    check(
      "the edit page says only the Owner can change it",
      /Only the Owner can change a booking once it is completed/.test(await flat(page)),
    );
    await page.goto(`${base}/admin/jobs/${firstLeg}`, { waitUntil: "networkidle" });
    check(
      "a Controller is never offered Delete booking",
      (await page.getByRole("button", { name: "Delete booking" }).count()) === 0,
    );
    await context.close();
  }

  res = await patch(owner, done, { pickupAddress: "Owner correction" });
  check(
    "the Owner can change a completed booking",
    res.status === 200 &&
      sql(`select pickup_address from jobs where id = ${done}`) === "Owner correction",
    `status ${res.status}`,
  );

  // --- The Owner deletes a website booking ---------------------------------------------
  const { page, context } = await session("owner@local.test");
  await page.goto(`${base}/admin/jobs/${done}`, { waitUntil: "networkidle" });
  check(
    "the Owner's completed booking page offers Edit",
    (await page.getByRole("link", { name: "Edit", exact: true }).count()) === 1,
  );

  // With a journey done, the booking is never offered for deletion.
  const lastLeg = Number(legs.split(",").at(-1));
  sql(`update jobs set status = 'completed' where id = ${lastLeg}`);
  await page.goto(`${base}/admin/jobs/${firstLeg}`, { waitUntil: "networkidle" });
  check(
    "a website booking with a journey done is never offered for deletion",
    (await page.getByRole("button", { name: "Delete booking" }).count()) === 0,
  );
  sql(
    `update jobs set status = '${
      legsSaved
        .split(";")
        .find((row) => row.startsWith(`${lastLeg}|`))
        .split("|")[1]
    }' where id = ${lastLeg}`,
  );

  await page.goto(`${base}/admin/jobs/${firstLeg}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Delete booking" }).click();
  const dialog = (await page.locator("dialog[open]").innerText()).replace(/\s+/g, " ");
  check(
    "Delete booking lists the journeys and says what is kept",
    dialog.includes(bookingRef) && /kept on record for TfL and the accounts/.test(dialog),
    dialog.slice(0, 160),
  );
  await page
    .locator("dialog[open] textarea[name=reason]")
    .fill("Duplicate booking (check)");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Delete booking" })
    .click();
  await page.waitForURL(/\/admin\/bookings\?notice=booking-deleted/, { timeout: 30_000 });
  check(
    "deleting returns to Bookings, which says so",
    /Website booking deleted/.test(await flat(page)),
  );
  check(
    "the booking and every journey are cancelled and archived, nothing erased",
    sql(
      `select status || ':' || (archived_at is not null) from bookings where id = ${bookingId}`,
    ) === "cancelled:true" &&
      sql(
        `select count(*) from jobs where booking_id = ${bookingId} and (status <> 'cancelled' or archived_at is null)`,
      ) === "0" &&
      sql(
        `select count(*) from job_events e join jobs j on j.id = e.job_id where j.booking_id = ${bookingId} and e.field = 'deleted'`,
      ) === String(legs.split(",").length),
  );
  const firstRef = sql(`select reference from jobs where id = ${firstLeg}`);
  await page.goto(`${base}/admin/bookings?when=all&q=${firstRef}`, {
    waitUntil: "networkidle",
  });
  check("it no longer shows in Bookings", !(await flat(page)).includes(firstRef));
  await page.goto(`${base}/admin/jobs/${firstLeg}`, { waitUntil: "networkidle" });
  const deletedPage = await flat(page);
  check(
    "its page still opens, marked deleted, with the reason in its history",
    /This booking was deleted/.test(deletedPage) &&
      /Booking deleted/.test(deletedPage) &&
      /Duplicate booking \(check\)/.test(deletedPage),
  );
  await page.screenshot({ path: `${shots}/booking-deleted.png`, fullPage: true });

  // --- The driver's payment statement ----------------------------------------------------
  const paymentId = Number(
    sql(
      "select id from driver_payments where voided_at is null order by id desc limit 1",
    ) || 0,
  );
  if (paymentId) {
    const key = Buffer.from(
      hkdfSync(
        "sha256",
        process.env.PAYLOAD_SECRET,
        "",
        "cityline statement-link v1",
        32,
      ),
    );
    const payloadPart = `${paymentId}.${Math.floor(Date.now() / 1000) + 3600}`;
    const signature = createHmac("sha256", key)
      .update(payloadPart, "utf8")
      .digest("base64url");
    const statement = await fetch(`${base}/api/statements/${payloadPart}.${signature}`);
    const bytes = Buffer.from(await statement.arrayBuffer());
    check(
      "the payment statement downloads as a PDF with the new design",
      statement.status === 200 &&
        statement.headers.get("content-type") === "application/pdf" &&
        bytes.subarray(0, 5).toString() === "%PDF-" &&
        bytes.length > 50_000,
      `status ${statement.status}, ${bytes.length} bytes`,
    );
    const forged = await fetch(
      `${base}/api/statements/${payloadPart}.${signature.slice(0, -2)}xx`,
    );
    check("a forged statement link opens nothing", forged.status === 404);
  } else {
    check(
      "a driver payment exists for the statement",
      false,
      "none in the local database",
    );
  }
  await context.close();
} finally {
  restore();
}

check("no JavaScript errors anywhere", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
