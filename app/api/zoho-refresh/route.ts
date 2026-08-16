import { NextResponse } from "next/server";
import { runZohoSync } from "@/lib/zoho/sync";

// Backs the "רענון נתונים מ-Zoho" button in the dashboard. Deliberately NOT
// under /api/sync/* -- that path is excluded from proxy.ts's cookie-session
// check (it uses its own CRON_SECRET bearer auth instead, for Vercel's cron).
// This route needs the opposite: only a logged-in browser session should be
// able to trigger it, which proxy.ts already covers for any route outside
// /api/sync.
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await runZohoSync("on_demand");
    return NextResponse.json({ status: "ok", result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
