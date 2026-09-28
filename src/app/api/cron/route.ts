import { NextResponse, type NextRequest } from "next/server";

import { runWorkerTick } from "@/worker";

/**
 * Called by system cron on the VPS every minute (§10):
 *   * * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron
 *
 * This is the safety net for the worker container — either can run the tick,
 * and the tick is safe to run twice.
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const result = await runWorkerTick();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export const GET = POST;
