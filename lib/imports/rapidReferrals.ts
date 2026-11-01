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
  // Row count per תאריך יצירה month ("YYYY-MM-01"), used by the automatic
  // email import to tell a month-end snapshot from the new month's first one.
  rowsByCreatedMonth: Record<string, number>;
};

// Rapid exports dates as "DD/MM/YYYY" strings; tolerate Excel serials too.
function createdMonth(v: unknown): string | null {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-01` : null;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v).trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-01` : null;
}

// The manual "Treatment Plans Report" export says True; the automatic
// "ירוקים2" email's DynamicReport says כן.
function isTruthy(v: unknown): boolean {
  return v === true || v === "True" || v === "TRUE" || v === 1 || v === "כן";
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
  const createdCol = header.indexOf("תאריך יצירה");
  const rowsByCreatedMonth: Record<string, number> = {};

  for (const r of dataRows) {
    const cm = createdCol !== -1 ? createdMonth(r[createdCol]) : null;
    if (cm) rowsByCreatedMonth[cm] = (rowsByCreatedMonth[cm] ?? 0) + 1;
    if (!isTruthy(r[closedCol])) {
      excludedNotClosed++;
      continue;
    }
    amount += Number(r[amountCol]) || 0;
    includedCount++;
  }

  return { amount, includedCount, excludedNotClosed, totalRows: dataRows.length, amountSource, rowsByCreatedMonth };
}

export async function applyReferralsImport(supabase: SupabaseClient, month: string, parsed: ParsedReferrals) {
  // synced_at only defaults to now() on INSERT -- an upsert that hits an
  // existing row (re-uploading the same month) is an UPDATE, which Postgres
  // does not touch the default for, so it must be set explicitly here or the
  // "last updated" badge freezes at whenever the row was first created
  // (confirmed real bug 2026-08-23: Meital re-uploaded but the date shown
  // in the dashboard didn't move).
  const { error } = await supabase.from("rapid_sales_categories").upsert(
    { month, category: REFERRALS_LABEL, division: null, amount: parsed.amount, synced_at: new Date().toISOString() },
    { onConflict: "month,category" }
  );
  if (error) throw new Error(`Failed to upsert referrals row: ${error.message}`);
  return { month, amount: parsed.amount };
}
