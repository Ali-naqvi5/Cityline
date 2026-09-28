import { NextResponse } from "next/server";

import { databaseReachable } from "@/lib/db";

/**
 * Deployment health check (NFR-02, §12 pipeline). The deploy script polls this
 * after `docker compose up`; a non-200 rolls back to the previous image tag.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await databaseReachable();

  return NextResponse.json(
    {
      status: database ? "ok" : "degraded",
      tag: process.env.APP_TAG ?? "unknown",
      database: database ? "ok" : "unreachable",
      launchGate: process.env.LAUNCH_GATE === "on" ? "on" : "off",
      time: new Date().toISOString(),
    },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
