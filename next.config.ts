import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

/**
 * Security headers (NFR-04). A full Content-Security-Policy with a per-request
 * nonce is added in the S7 security pass, once Stripe / Google Maps / GA4 origins
 * are all known — it is deliberately not guessed here.
 *
 * Stripe's origins are now known. From Stripe's integration security guide,
 * the CSP must allow, for Stripe.js and the Payment Element:
 *   script-src   https://js.stripe.com https://*.js.stripe.com
 *   frame-src    https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com
 *   connect-src  https://api.stripe.com
 * and for Link (shown by the Payment Element when enabled):
 *   frame-src / connect-src  https://link.com https://*.link.com
 *   img-src                  https://*.link.com
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    /*
     * `payment` must name Stripe's origins as well as our own. The Payment
     * Element runs in Stripe's iframe, and a cross-origin iframe can only use
     * the Payment Request API — which Apple Pay and Google Pay go through — if
     * the top-level page's policy allows that origin. `payment=(self)` alone
     * silently hides both wallets.
     */
    value:
      'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com" "https://*.js.stripe.com")',
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // The Docker image runs `node server.js` from the standalone output (§12).
  output: "standalone",

  // Fail the production build on type errors. Linting is a separate CI step in
  // Next 16 (`next lint` was removed), see .github/workflows/ci.yml (NFR-07).
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,

  // Hides the floating Next.js badge in the corner during development. It
  // overlaps the bottom-left of the page and gets in the way of reviewing
  // designs; it never appears in production either way.
  devIndicators: false,

  images: {
    formats: ["image/avif", "image/webp"],
    // Remote hosts are added as real image sources appear (media library is local).
    remotePatterns: [],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

/**
 * `withPayload` mounts the admin and Payload's REST/GraphQL routes inside this
 * app (§10: Payload runs in the same Next.js process, not as a separate
 * service). It does not touch the public pages — nothing under `(site)`
 * imports Payload, so the marketing bundle is unaffected.
 */
export default withPayload(nextConfig, { devBundleServerPackages: false });
