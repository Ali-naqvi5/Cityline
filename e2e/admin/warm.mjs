// Opens admin pages once so the dev server compiles them before a check runs.
// Usage: node --env-file=.env.local e2e/admin/warm.mjs /admin/bookings /admin/drivers
import "./local-only.mjs";
import { chromium } from "@playwright/test";
const paths = process.argv.slice(2);
const b = await chromium.launch();
const c = await b.newContext();
await c.request.post("http://localhost:3000/api/users/login", {
  data: { email: "owner@local.test", password: process.env.ADMIN_TEST_PASSWORD },
  timeout: 280000,
});
const p = await c.newPage();
for (const path of paths) {
  const t0 = Date.now();
  await p.goto("http://localhost:3000" + path, {
    waitUntil: "networkidle",
    timeout: 400000,
  });
  console.log("warm", path, Date.now() - t0, "ms");
}
await b.close();
