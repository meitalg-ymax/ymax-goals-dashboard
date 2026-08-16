import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

// Imports a "Treatment Plans Report" export (quote proposals created by the
// referrals coordinator) as the ירוקים (הפניות) actual for the current
// month. The report has no division column at all -- every row is just a
// customer + a closed quote -- so, like "מוצרים יפה", this lands as one
// company-wide row in rapid_sales_categories (division=null), not split per
// division.
//
// Sums EVERY row where סגורה=True, regardless of תאריך יצירה -- confirmed
// with Meital 2026-08-16 after a real discrepancy (she summed ₪123,260 from
// the file, the dashboard showed ₪115,160 because it was excluding a row
// created in a prior month). The report is a current/rolling snapshot, not
// a permanent historical log, so "everything in the file" IS this month's
// real total -- don't re-add a date filter here.
//
// Sums תקבולים (amount actually RECEIVED so far), not סך הכל לאחר הנחה (the
// full closed deal value) -- a closed deal can be paid in installments, so
// the deal total can overstate what's actually landed this month (confirmed
// with Meital 2026-08-12). Falls back to סך הכל לאחר הנחה for older report
// exports that predate the תקבולים column.
//
// This is the canonical copy of this parsing logic -- scripts/import-rapid-referrals.mjs
// is the same thing as a standalone local script (kept for one-off manual runs,
// still date-filtered -- not updated to match, since it's not the active path
// anymore), but this is what the "עדכון ירוקים" upload button in the dashboard calls.
const REFERRALS_LABEL = "ירוקים (הפניות)";

export type ParsedReferrals = {
  amount: number;
  includedCount: number;
  excludedNotClosed: number;
  totalRows: number;
  amountSource: string;
};

function isTruthy(v: unknown): boolean {
  return v === true || v === "True" || v === "TRUE" || v === 1;
}

export function parseReferralsReport(buffer: Buffer): ParsedReferrals {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets["Export"];
  if (!ws) throw new Error(`Expected an "Export" sheet, found: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
  const header = rows[0] as string[];
  const dataRows = rows.slice(1).filter((r) => r.length && r[0] !== "");

  const closedCol = header.indexOf("סגורה");
  const receivedCol = header.indexOf("תקבולים");
  const totalCol = header.indexOf("סך הכל לאחר הנחה");
  const amountCol = receivedCol !== -1 ? receivedCol : totalCol;
  if (closedCol === -1 || amountCol === -1) {
    throw new Error(`Unexpected header, missing a required column: ${JSON.stringify(header)}`);
  }
  const amountSource = receivedCol !== -1 ? "תקבולים" : "סך הכל לאחר הנחה (fallback, no תקבולים column found)";

  let amount = 0;
  let includedCount = 0;
  let excludedNotClosed = 0;

  for (const r of dataRows) {
    if (!isTruthy(r[closedCol])) {
      excludedNotClosed++;
      continue;
    }
    amount += Number(r[amountCol]) || 0;
    includedCount++;
  }

  return { amount, includedCount, excludedNotClosed, totalRows: dataRows.length, amountSource };
}

export async function applyReferralsImport(supabase: SupabaseClient, month: string, parsed: ParsedReferrals) {
  const { error } = await supabase
    .from("rapid_sales_categories")
    .upsert({ month, category: REFERRALS_LABEL, division: null, amount: parsed.amount }, { onConflict: "month,category" });
  if (error) throw new Error(`Failed to upsert referrals row: ${error.message}`);
  return { month, amount: parsed.amount };
}
