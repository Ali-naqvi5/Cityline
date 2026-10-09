# Admin checks

Browser checks for the operations admin (`/admin`). Each suite signs in as
local test staff, works through real screens (adding drivers, taking
bookings, assigning, recording payments) and checks both the screens and the
database. Run them before every deploy.

They are separate from `pnpm e2e` (the public website's Playwright tests) and
never run against the live site: each one stops unless `DATABASE_URL` points at
the local database.

## Before running

1. Start the local database: `pnpm db:up` (Docker container
   `cityline-local-db-1`).
2. Start the dev server **with emails off**, so no real email can go out:
   `NUNTLY_API_KEY= pnpm dev`
3. In `.env.local`, set `ADMIN_TEST_PASSWORD` to the password of the local test
   staff accounts: `owner@local.test`, `controller@local.test`,
   `accounts@local.test`. Never commit it.

The suites expect the local database as it has been built up in development:
those staff accounts, earlier website test bookings, and the drivers, cars,
partners and payments the earlier suites create. They are not yet able to start
from an empty database.

## Running

```
pnpm e2e:admin                    # every suite, in order (about 20–25 minutes)
pnpm e2e:admin dispatch payments  # just those
```

The first visit to each page compiles it, so a cold dev server can time out. To
warm pages first:

```
node --env-file=.env.local e2e/admin/warm.mjs /admin/bookings /admin/drivers
```

Each suite prints `PASS` or `FAIL` per check. Screenshots go to
`test-results/admin/`, which git ignores. The suites create test records in the
local database and remove them afterwards. Some, such as `fleet` and `dispatch`,
reset their own fixtures at the start.
