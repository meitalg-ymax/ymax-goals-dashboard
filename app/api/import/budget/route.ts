import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServiceClient } from "@/lib/supabase/service";
import { parseBudgetSheet, budgetSheetTabName } from "@/lib/imports/budgetSheet";

// Backs the "עדכון תקציב שנוצל" button. Meital's budget tracker is a Google
// Sheet shared "anyone with the link can view", with one tab per month
// ("אוגוסט 2026", etc.) -- fetches the WHOLE workbook (no per-tab gid) and
// picks the current month's tab by name, so this keeps working next month
// with zero code/env changes as long as she keeps making a new tab with the
// same naming pattern.
export const maxDuration = 30;

function currentMonthStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST() {
  const sheetId = process.env.BUDGET_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json({ error: "BUDGET_SHEET_ID לא מוגדר בסביבה" }, { status: 500 });
  }

  try {
    const workbookUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const res = await fetch(workbookUrl);
    if (!res.ok) throw new Error(`Failed to fetch budget workbook: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    const tabName = budgetSheetTabName(new Date());
    const ws = wb.Sheets[tabName];
    if (!ws) {
      throw new Error(
        `לא נמצאה לשונית "${tabName}" בגיליון. לשוניות קיימות: ${wb.SheetNames.join(", ")}`
      );
    }

    const csvText = XLSX.utils.sheet_to_csv(ws);
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

    return NextResponse.json({ status: "ok", month, tabName, divisionsUpdated: rows.length, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
