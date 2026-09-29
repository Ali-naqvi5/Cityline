/**
 * Content Security Policy (NFR-04).
 *
 * Two policies, chosen per path by `src/proxy.ts`:
 *
 *   **Nonce** — the booking funnel and Manage booking, where the card form and
 *   the customer's details are. Scripts run only if they carry this request's
 *   nonce, or were loaded by one that did (`'strict-dynamic'`, which is how
 *   Next's chunks and Stripe.js get in). An injected `<script>` does not run.
 *   A nonce has to be new on every request, so these pages must render per
 *   request; their layouts call `connection()` to make sure of it.
 *
 *   **Static** — every other page. They are built once and served from disk,
 *   and a page built ahead of time cannot carry a per-request nonce, so inline
 *   scripts are allowed. Everything else still holds: scripts only from here
 *   and Stripe, data only to here and Stripe, no plugins, no framing, forms
 *   only to this site. That is Next's documented policy for static pages.
 *
 * Both allow Stripe. Someone who starts on the home page and clicks through to
 * pay never reloads the page, and a page keeps the policy it was loaded with —
 * so the home page's policy is the one the Payment Element runs under.
 *
 * The Stripe origins are from Stripe's integration security guide (Stripe.js
 * and Link sections). Styles allow `'unsafe-inline'` in both: React renders
 * `style` attributes, which a nonce cannot cover, and style injection cannot
 * run code.
 *
 * `upgrade-insecure-requests` is left out on purpose. HSTS (next.config.ts)
 * already keeps browsers on HTTPS, every URL here is relative, and the
 * directive would break the site over plain http://localhost.
 */

const STRIPE = {
  script: ["https://js.stripe.com", "https://*.js.stripe.com"],
  frame: [
    "https://js.stripe.com",
    "https://*.js.stripe.com",
    "https://hooks.stripe.com",
    "https://link.com",
    "https://*.link.com",
  ],
  connect: ["https://api.stripe.com", "https://link.com", "https://*.link.com"],
  img: ["https://*.stripe.com", "https://*.link.com"],
};

export interface PolicyOptions {
  /** Present for the nonce policy, absent for the static one. */
  nonce?: string;
  /** React needs `eval` in development only, to rebuild server error stacks. */
  dev: boolean;
}

export function contentSecurityPolicy({ nonce, dev }: PolicyOptions): string {
  const script = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...STRIPE.script]
    : ["'self'", "'unsafe-inline'", ...STRIPE.script];
  if (dev) script.push("'unsafe-eval'");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": script,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...STRIPE.img],
    "font-src": ["'self'"],
    // `ws:` carries hot reload in development.
    "connect-src": ["'self'", ...STRIPE.connect, ...(dev ? ["ws:"] : [])],
    "frame-src": STRIPE.frame,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/** Pages that get the nonce policy. They must all render per request. */
const NONCE_PREFIXES = ["/book", "/manage"];

/**
 * No policy: the admin is Payload's own app, and API responses are not pages.
 * Both still get `X-Frame-Options` and the other headers in next.config.ts.
 */
const NO_POLICY_PREFIXES = ["/admin", "/api"];

export type PolicyKind = "nonce" | "static" | "none";

function under(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Which policy a request gets. `gated` means the launch gate is showing the
 * coming-soon page instead, which is a static page whatever the URL was.
 */
export function policyKindFor(pathname: string, gated: boolean): PolicyKind {
  if (under(pathname, NO_POLICY_PREFIXES)) return "none";
  if (gated) return "static";
  return under(pathname, NONCE_PREFIXES) ? "nonce" : "static";
}

/** 128 random bits, base64 — fresh for every request that uses the nonce policy. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
