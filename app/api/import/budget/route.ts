import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseBudgetSheet } from "@/lib/imports/budgetSheet";

// Backs the "עדכון תקציב שנוצל" button. Unlike the rapid-sales/referrals
// buttons, this one needs no file upload -- Meital's budget tracker is a
// Google Sheet shared "anyone with the link can view", so its CSV export
// URL is fetchable directly (see BUDGET_SHEET_CSV_URL). One click re-pulls
// whatever she's currently entered in the sheet.
export const maxDuration = 30;

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST() {
  const sheetUrl = process.env.BUDGET_SHEET_CSV_URL;
  if (!sheetUrl) {
    return NextResponse.json({ error: "BUDGET_SHEET_CSV_URL לא מוגדר בסביבה" }, { status: 500 });
  }

  try {
    const res = await fetch(sheetUrl);
    if (!res.ok) throw new Error(`Failed to fetch budget sheet: HTTP ${res.status}`);
    const csvText = await res.text();

    const rows = parseBudgetSheet(csvText);
    const month = currentMonthStart();

    const supabase = createServiceClient();
    const { error } = await supabase.from("manual_entries").upsert(
      rows.map((r) => ({
        kind: "rapid_actual" as const,
        month,
        division: r.division,
        metric: "budget_funded",
        value: r.budgetActual,
      })),
      { onConflict: "kind,month,division,metric" }
    );
    if (error) throw new Error(`Failed to upsert budget_funded: ${error.message}`);

    return NextResponse.json({ status: "ok", month, divisionsUpdated: rows.length, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
