import { z } from "zod";

/**
 * Validated environment (§16). Import this instead of touching `process.env`,
 * so a missing key fails fast at boot rather than at 3am on a booking.
 *
 * NOT imported by `src/proxy.ts`: the proxy reads `process.env` directly to keep
 * its bundle tiny.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  NEXT_PUBLIC_SITE_URL: z.string().url(),
  PAYLOAD_SECRET: z.string().min(32, "PAYLOAD_SECRET must be at least 32 characters"),
  LAUNCH_GATE: z.enum(["on", "off"]).default("on"),
  PREVIEW_TOKEN: z.string().min(8),
  CRON_SECRET: z.string().min(8),
  APP_TAG: z.string().default("local"),

  DATABASE_URL: z.string().url(),
  STORAGE_PATH: z.string().default("./storage"),

  // Optional until the relevant sprint wires them up (S4 onward).
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_MAPS_SERVER_KEY: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  /** Nuntly (NOT-01, NOT-03). A send-only key is enough. */
  NUNTLY_API_KEY: z.string().optional(),
  /** Sender, e.g. `Cityline Airport Transfers <bookings@…>`; its domain must be verified in Nuntly. */
  MAIL_FROM: z.string().optional(),
  /** Where new-booking alerts go (NOT-03). */
  OFFICE_ALERT_EMAIL: z.string().email().optional(),
  /**
   * `live` sends customer emails to customers. Anything else — including unset,
   * the default — redirects them to OFFICE_ALERT_EMAIL (PRD-04: email limited
   * to staff until launch).
   */
  CUSTOMER_EMAILS: z.enum(["live", "staff-only"]).default("staff-only"),
  TWILIO_SID: z.string().optional(),
  TWILIO_TOKEN: z.string().optional(),
  TWILIO_FROM: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
