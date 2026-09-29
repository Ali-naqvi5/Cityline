import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";

import { migrations } from "@/migrations";

import { Bookings } from "@/collections/Bookings";
import { Customers } from "@/collections/Customers";
import { JobEvents } from "@/collections/JobEvents";
import { Jobs } from "@/collections/Jobs";
import { Payments } from "@/collections/Payments";
import { Quotes } from "@/collections/Quotes";
import { Refunds } from "@/collections/Refunds";
import { Users } from "@/collections/Users";
import { WebhookEvents } from "@/collections/WebhookEvents";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Payload CLI commands that roll back or wipe the database (DATA-03). Each is
 * replaced by a script that refuses — see `src/bin/refuse-destructive-migration.ts`.
 * `ALLOW_DESTRUCTIVE_MIGRATIONS=yes` lifts the block for one deliberate run
 * against a local development database, and never belongs on the server.
 */
const DESTRUCTIVE_MIGRATIONS = [
  "migrate:down",
  "migrate:reset",
  "migrate:refresh",
  "migrate:fresh",
] as const;

const destructiveMigrationGuard =
  process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "yes"
    ? []
    : DESTRUCTIVE_MIGRATIONS.map((key) => ({
        key,
        scriptPath: path.resolve(dirname, "bin/refuse-destructive-migration.ts"),
      }));

/**
 * Payload CMS 3, running inside this Next.js app (§10).
 *
 * The spec schedules the admin for S8, last. It is here earlier for one
 * reason: §14 says "tables are Payload collections unless noted", so the
 * booking tables the funnel needs *are* Payload collections. Hand-writing them
 * now and migrating them into Payload later would mean writing them twice and
 * running two migration systems in between.
 *
 * What is deliberately NOT here yet:
 *
 *   - The catalogue (vehicle classes, extras, places, routes, tariffs). Those
 *     stay as typed constants in `src/domain` and `src/content` until S2
 *     brings real prices. Moving them now would turn the airport, fleet and
 *     fares pages from static HTML served in ~6ms into database queries, and
 *     SEO-02 wants that done properly with revalidation rather than as a
 *     side-effect of this change.
 *   - Drivers, vehicles, suppliers and finance (S8–S10).
 *
 * The admin UI exists at /admin but is not a public surface: `src/proxy.ts`
 * sends `X-Robots-Tag: noindex`, `robots.ts` disallows it, and it requires a
 * Payload user to log in.
 */
export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL,

  // The Payload CLI checks `bin` before its own commands, so these names run
  // the refusal script instead of touching the database.
  bin: destructiveMigrationGuard,

  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: "· Cityline",
    },
  },

  collections: [
    // Booking side — everything the website funnel writes.
    Customers,
    Quotes,
    Bookings,
    Jobs,
    JobEvents,
    Payments,
    Refunds,
    WebhookEvents,
    // Staff accounts for the admin itself.
    Users,
  ],

  editor: lexicalEditor(),

  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    /**
     * Off everywhere, including `next dev`. Every database — local included —
     * is shaped only by the reviewed migrations in `src/migrations` (DATA-03),
     * which `deploy.sh` also runs in production.
     *
     * Payload's default is to "push" in development: rewrite the database to
     * match the collections on first use. That is unsafe here because part of
     * the schema lives only in migrations — the partial unique index on
     * (booking, leg), the source/booking check constraint and
     * `job_reference_seq` — and a push would drop them. Payload's own docs say
     * not to mix push and migrations on one database, and suggest either a
     * sandbox database for push or `push: false`. A sandbox would lack those
     * three objects (Payload's schema hooks cannot declare a sequence, and
     * declaring the index there would make the next generated migration
     * re-create it), so migrations-only it is.
     *
     * The cost: after changing a collection, run `pnpm migrate:create <name>`,
     * review the file, then `pnpm migrate`, or dev pages that touch that
     * collection error until you do.
     */
    push: false,
    /**
     * Must stay set even in production. `prodMigrations` below is what actually
     * runs there, but Payload still resolves this path first — and if it is
     * unset it falls back to scanning `src/migrations`, which the bundled
     * runner does not ship, then dies trying to import a `.ts` file at runtime.
     *
     * The bundled runner therefore logs one harmless line per deploy:
     *   ERROR: No migration directory found at /app/dist/migrations
     * It is not an error. The migration from `prodMigrations` runs immediately
     * after it, and `deploy.sh` fails the deploy on a non-zero exit, not on log
     * output.
     */
    migrationDir: path.resolve(dirname, "migrations"),
    /**
     * Imported statically from the generated `migrations/index.ts` rather than
     * discovered by scanning the directory. The production image ships a
     * bundled `dist/migrate.js`, where there is no `src/migrations` folder to
     * scan — a directory scan would find nothing and report "no migrations to
     * run", which is the worst possible way for this to fail.
     */
    prodMigrations: migrations,
  }),

  /**
   * `PAYLOAD_SECRET` signs admin sessions and the magic-link tokens customers
   * use to reach their booking. `env.ts` already requires it to be at least 32
   * characters. Rotating it logs everyone out and invalidates outstanding
   * links, so it is set once on the VPS and left alone.
   */
  secret: process.env.PAYLOAD_SECRET || "",

  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },

  /**
   * Uploads live in the storage volume, outside the app image (DATA-02), so a
   * deployment cannot take them with it.
   */
  upload: {
    limits: { fileSize: 10_000_000 },
  },
});
