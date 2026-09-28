import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import proxy from "./proxy";

/**
 * PRD-02. Getting the launch gate wrong means a half-built site gets indexed,
 * which is slow and expensive to undo — so it is tested at the unit level,
 * where it runs in milliseconds on every commit.
 *
 * The browser-level version of these checks lives in e2e/launch-gate.spec.ts
 * and switches on in S3 with the booking funnel.
 */
const TOKEN = "test-preview-token";

function request(path: string, init?: { cookie?: string }): NextRequest {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(new URL(path, "https://citylineairporttransfers.com"), {
    headers,
  });
}

/** NextResponse.rewrite() records its target in this internal header. */
function rewriteTarget(response: Response): string | null {
  return response.headers.get("x-middleware-rewrite");
}

let originalGate: string | undefined;
let originalToken: string | undefined;

beforeEach(() => {
  originalGate = process.env.LAUNCH_GATE;
  originalToken = process.env.PREVIEW_TOKEN;
  process.env.LAUNCH_GATE = "on";
  process.env.PREVIEW_TOKEN = TOKEN;
});

afterEach(() => {
  process.env.LAUNCH_GATE = originalGate;
  process.env.PREVIEW_TOKEN = originalToken;
});

describe("launch gate on", () => {
  it("sends the public to the coming-soon page, marked noindex", () => {
    const response = proxy(request("/"));

    expect(rewriteTarget(response)).toContain("/coming-soon");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("gates every site URL, not just the home page", () => {
    expect(rewriteTarget(proxy(request("/airports/heathrow")))).toContain("/coming-soon");
    expect(rewriteTarget(proxy(request("/transfers/heathrow-to-gatwick")))).toContain(
      "/coming-soon",
    );
  });

  it("lets staff and machines through on the exempt paths", () => {
    for (const path of ["/api/health", "/api/cron", "/api/webhooks/stripe", "/admin"]) {
      expect(rewriteTarget(proxy(request(path)))).toBeNull();
    }
  });

  it("does not gate the coming-soon page itself, which would loop", () => {
    expect(rewriteTarget(proxy(request("/coming-soon")))).toBeNull();
  });

  it("grants a preview cookie and drops the token from the URL", () => {
    const response = proxy(request(`/?preview=${TOKEN}`));

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).not.toContain("preview=");

    const cookie = response.cookies.get("cityline_preview");
    expect(cookie?.value).toBe(TOKEN);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("lets a request with the preview cookie through", () => {
    const response = proxy(request("/", { cookie: `cityline_preview=${TOKEN}` }));
    expect(rewriteTarget(response)).toBeNull();
  });

  it("keeps a wrong token, and a wrong cookie, gated", () => {
    expect(rewriteTarget(proxy(request("/?preview=wrong")))).toContain("/coming-soon");
    expect(
      rewriteTarget(proxy(request("/", { cookie: "cityline_preview=wrong" }))),
    ).toContain("/coming-soon");
  });

  it("stays gated when no preview token is configured at all", () => {
    delete process.env.PREVIEW_TOKEN;
    expect(rewriteTarget(proxy(request("/")))).toContain("/coming-soon");
    expect(rewriteTarget(proxy(request("/", { cookie: "cityline_preview=" })))).toContain(
      "/coming-soon",
    );
  });
});

describe("launch gate off", () => {
  beforeEach(() => {
    process.env.LAUNCH_GATE = "off";
  });

  it("serves the real site", () => {
    const response = proxy(request("/"));
    expect(rewriteTarget(response)).toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  it("still keeps the admin, manage and booking steps out of the index (SEO-03)", () => {
    for (const path of ["/admin", "/manage/CL-7K4Q2P", "/book/vehicle", "/api/health"]) {
      expect(proxy(request(path)).headers.get("X-Robots-Tag")).toContain("noindex");
    }
  });
});
