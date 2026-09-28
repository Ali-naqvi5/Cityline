import { NextResponse, type NextRequest } from "next/server";

/**
 * Launch gate (PRD-02) and indexing headers (SEO-03).
 *
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`.
 * This file reads `process.env` directly rather than importing `src/env.ts`,
 * to keep the proxy bundle small.
 *
 * While the gate is on:
 *   - the public sees the coming-soon page on every site URL,
 *   - staff still reach /admin normally,
 *   - owners preview with ?preview=<PREVIEW_TOKEN>, which sets a cookie.
 */

const PREVIEW_COOKIE = "cityline_preview";

/** Paths that must keep working while the gate is on. */
const GATE_EXEMPT_PREFIXES = [
  "/api/health",
  "/api/cron",
  "/api/webhooks",
  "/admin",
  "/coming-soon",
];

/** Never indexed, gate or no gate (SEO-03). */
const NOINDEX_PREFIXES = ["/admin", "/manage", "/book", "/api"];

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Constant-time compare so the preview token can't be guessed by timing. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function proxy(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  const gateOn = process.env.LAUNCH_GATE === "on";
  const previewToken = process.env.PREVIEW_TOKEN ?? "";

  // A valid ?preview=<token> grants a cookie and drops the query string, so the
  // token never ends up in a shared link, an analytics hit or a Referer header.
  const suppliedToken = searchParams.get("preview");
  if (suppliedToken && previewToken && secretsMatch(suppliedToken, previewToken)) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("preview");
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set(PREVIEW_COOKIE, previewToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  const hasPreviewCookie = secretsMatch(
    request.cookies.get(PREVIEW_COOKIE)?.value ?? "",
    previewToken || "\u0000",
  );

  const gated =
    gateOn && !hasPreviewCookie && !startsWithAny(pathname, GATE_EXEMPT_PREFIXES);

  const response = gated
    ? NextResponse.rewrite(new URL("/coming-soon", request.url))
    : NextResponse.next();

  if (gated || startsWithAny(pathname, NOINDEX_PREFIXES)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own static output and common static files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
