import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AdminViewServerProps } from "payload";

import { requireStaff } from "@/admin/guard";
import { Badge, PageHeader, Panel } from "@/components/ops/primitives";
import { OpsShell } from "@/components/ops/shell";
import { NoAccess } from "@/components/ops/states";

/**
 * System settings and the raw record screens (Owner only).
 *
 * Shows how the live system is configured — never a secret, only whether it
 * is set and which mode it is in — and links to Payload's built-in record
 * screens for anything that has no purpose-built screen yet. Those still obey
 * every collection's access rules.
 */

function stripeMode(): { label: string; tone: "ok" | "warn" | "neutral" } {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (/^(sk|rk)_live_/.test(key)) return { label: "Live — real payments", tone: "ok" };
  if (/^(sk|rk)_test_/.test(key))
    return { label: "Test mode — no real money", tone: "warn" };
  return { label: "Not configured", tone: "neutral" };
}

const RECORDS = [
  {
    slug: "users",
    label: "Staff accounts",
    note: "Create staff and set roles until the Staff screen is built.",
  },
  { slug: "customers", label: "Customers", note: "Created by website checkout." },
  { slug: "bookings", label: "Website bookings", note: "Created by checkout only." },
  { slug: "jobs", label: "Jobs", note: "The operations screens are the normal way in." },
  { slug: "job-events", label: "Job history", note: "Append-only." },
  { slug: "payments", label: "Payments", note: "Written by Stripe." },
  { slug: "refunds", label: "Refunds", note: "" },
  { slug: "quotes", label: "Quotes", note: "Priced journeys; expire after 30 minutes." },
  { slug: "webhook-events", label: "Webhook events", note: "Stripe's delivery log." },
];

export async function SettingsView(props: AdminViewServerProps) {
  const context = requireStaff(props, "system.view", "/admin/settings");
  if (context.denied) {
    return (
      <div className="ops-root min-h-dvh p-4">
        <NoAccess reason={context.reason} />
      </div>
    );
  }
  const { user } = context;
  const gateOn = process.env.LAUNCH_GATE === "on";
  const customerEmails = process.env.CUSTOMER_EMAILS === "live";
  const stripe = stripeMode();

  return (
    <OpsShell user={user} active="settings">
      <PageHeader
        title="Settings"
        description="How the live system is configured, and the raw record screens."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="System"
          description="Changed in the server's .env.production, then the app is restarted"
        >
          <dl className="divide-line divide-y text-sm">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-2">Public website</dt>
              <dd>
                {gateOn ? (
                  <Badge tone="warn">Coming-soon page shown</Badge>
                ) : (
                  <Badge tone="ok">Live</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-2">Customer emails</dt>
              <dd>
                {customerEmails ? (
                  <Badge tone="ok">Sent to customers</Badge>
                ) : (
                  <Badge tone="warn">Redirected to the office</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-2">Email sending</dt>
              <dd>
                {process.env.NUNTLY_API_KEY ? (
                  <Badge tone="ok">Configured</Badge>
                ) : (
                  <Badge>Not configured</Badge>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-2">Card payments</dt>
              <dd>
                <Badge tone={stripe.tone}>{stripe.label}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-2">Office alerts go to</dt>
              <dd className="text-ink">{process.env.OFFICE_ALERT_EMAIL || "Not set"}</dd>
            </div>
          </dl>
        </Panel>

        <Panel
          title="Records"
          description="Payload's built-in screens, for records without a purpose-built screen yet"
          bodyClassName="p-0"
        >
          <ul className="divide-line divide-y">
            {RECORDS.map((record) => (
              <li key={record.slug}>
                <Link
                  href={`/admin/collections/${record.slug}`}
                  className="hover:bg-sunken/60 flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="text-ink block text-sm font-medium">
                      {record.label}
                    </span>
                    {record.note ? (
                      <span className="text-ink-3 block text-xs">{record.note}</span>
                    ) : null}
                  </span>
                  <ExternalLink aria-hidden className="text-ink-4 h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </OpsShell>
  );
}
