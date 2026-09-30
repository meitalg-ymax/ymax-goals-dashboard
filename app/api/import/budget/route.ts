import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseDailyBudgetSheet } from "@/lib/imports/budgetSheet";

// Backs both the "עדכון תקציב שנוצל" manual button (POST, no auth -- same as
// the other DataOpsBar buttons) and the daily Vercel cron (GET, CRON_SECRET
// like /api/sync/zoho). Meital's tracker is a single continuously-updated
// Google Sheet tab ("מעקב יומי"), fetched by CSV export -- no OAuth needed
// since it's shared "anyone with the link can view".
export const maxDuration = 30;

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function fetchAndParseBudgetSheet(sheetId: string, gid: string, now: Date) {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch budget sheet: HTTP ${res.status}`);
  const csvText = await res.text();
  return parseDailyBudgetSheet(csvText, now);
}

async function runBudgetImport() {
  const sheetId = process.env.BUDGET_SHEET_ID;
  const gid = process.env.BUDGET_SHEET_GID;
  if (!sheetId || !gid) {
    throw new Error("BUDGET_SHEET_ID / BUDGET_SHEET_GID לא מוגדרים בסביבה");
  }

  const now = new Date();
  // Google's CSV export occasionally comes back truncated mid-row (confirmed
  // 2026-09-17: one cron run silently froze 4 of 5 divisions at yesterday's
  // value because their columns fell past where the response cut off) --
  // parseDailyBudgetSheet throws when it detects that, so retry once before
  // giving up rather than skipping the day's update entirely.
  let rows;
  try {
    rows = await fetchAndParseBudgetSheet(sheetId, gid, now);
  } catch {
    rows = await fetchAndParseBudgetSheet(sheetId, gid, now);
  }
  const month = currentMonthStart();

  const supabase = createServiceClient();
  // updated_at only defaults to now() on INSERT -- an upsert that hits an
  // existing row (re-running this daily, for the same month) is an UPDATE,
  // which Postgres leaves the default alone for, so it must be set
  // explicitly here or the "last updated" badge freezes at whenever the row
  // was first created (confirmed real bug 2026-08-23: budget kept
  // refreshing but the shown date never moved).
  const nowIso = now.toISOString();
  const { error } = await supabase.from("manual_entries").upsert(
    rows.map((r) => ({
      kind: "rapid_actual" as const,
      month,
      division: r.division,
      metric: "budget_funded",
      value: r.budgetActual,
      updated_at: nowIso,
    })),
    { onConflict: "kind,month,division,metric" }
  );
  if (error) throw new Error(`Failed to upsert budget_funded: ${error.message}`);

  return { month, divisionsUpdated: rows.length, rows };
}

export async function POST() {
  try {
    const result = await runBudgetImport();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBudgetImport();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
