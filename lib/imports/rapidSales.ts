import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Division } from "@/lib/zoho/transform";

// Imports a Rapid POS "SalesReport" export (general clinic revenue -- hair
// removal, injections, tech treatments, MiraDry, and clinic products). This
// is the real source behind revenue_spa_upgrades: it REPLACES whatever was
// manually typed for that metric/month, for every division found in the
// report. It also stores the full raw category breakdown in
// rapid_sales_categories so the dashboard overview can show "money by
// category", not just the 5-division rollup.
//
// The report's own title row ("מתאריך:[01/08/2026] עד:[31/08/2026]") decides
// which month gets replaced -- not today's date -- so re-uploading a past
// month's corrected report is safe.
//
// This is the canonical copy of this parsing logic -- scripts/import-rapid-sales.mjs
// is the same thing as a standalone local script (kept for one-off manual runs),
// but this is what the "עדכון כסף ראפיד" upload button in the dashboard calls.

// קטגוריה (raw report category) -> division mapping. Confirmed with Meital
// 2026-08-11. "מוצרים יפה מקסימוב" and "מוצרים ותכשירים" are general product
// sales that don't belong to any division's funnel -- merged into one
// "מוצרים יפה" row with division=null, shown only in the overview.
const CATEGORY_TO_DIVISION: Record<string, Division> = {
  "YMAX PRO הסרת שיער": "ymax",
  "YMAX הסרת שיער פנים": "ymax",
  "הסרת שיער גוף PRO": "body",
  "הסרת שיער גוף": "body",
  "טיפולים טכנולוגיים": "tech",
  הזרקות: "doctor",
  "טיפול בהזעת יתר": "mira_dry",
};
const PRODUCT_CATEGORIES = ["מוצרים יפה מקסימוב", "מוצרים ותכשירים"];
const PRODUCTS_LABEL = "מוצרים יפה";

export type CategoryRow = { category: string; division: Division | null; amount: number };
export type ParsedRapidSales = {
  month: string;
  categoryRows: CategoryRow[];
  unmapped: { category: string; amount: number }[];
  rowCount: number;
};

// Title row looks like: 'דוח מכירות מנפיק:[...] מתאריך:[01/08/2026] עד:[31/08/2026], סניפים:[כולם]'
function monthFromTitle(title: string): string | null {
  const m = title.match(/מתאריך:\[(\d{2})\/(\d{2})\/(\d{4})\]/);
  if (!m) return null;
  const [, , mm, yyyy] = m;
  return `${yyyy}-${mm}-01`;
}

export function parseRapidSalesReport(buffer: Buffer): ParsedRapidSales {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets["SalesReport"];
  if (!ws) throw new Error(`Expected a "SalesReport" sheet, found: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
  const month = monthFromTitle(String(rows[0][0]));
  if (!month) throw new Error(`Could not parse date range from title row: ${rows[0][0]}`);

  const dataRows = rows.slice(3).filter((r) => r.length && r[0] !== "");

  const rawTotals = new Map<string, number>();
  for (const r of dataRows) {
    const category = String(r[2]);
    const total = Number(r[15]) || 0;
    rawTotals.set(category, (rawTotals.get(category) ?? 0) + total);
  }

  const categoryRows: CategoryRow[] = [];
  const unmapped: { category: string; amount: number }[] = [];
  let productsTotal = 0;

  for (const [category, amount] of rawTotals) {
    if (PRODUCT_CATEGORIES.includes(category)) {
      productsTotal += amount;
      continue;
    }
    const division = CATEGORY_TO_DIVISION[category];
    if (!division) {
      unmapped.push({ category, amount });
      continue;
    }
    categoryRows.push({ category, division, amount });
  }
  if (productsTotal > 0) {
    categoryRows.push({ category: PRODUCTS_LABEL, division: null, amount: productsTotal });
  }
  for (const u of unmapped) {
    categoryRows.push({ category: u.category, division: null, amount: u.amount });
  }

  return { month, categoryRows, unmapped, rowCount: dataRows.length };
}

export async function applyRapidSalesImport(supabase: SupabaseClient, parsed: ParsedRapidSales) {
  const { month, categoryRows, unmapped } = parsed;

  // Replace this importer's own categories for the month only --
  // rapid_sales_categories also holds rows from the referrals importer,
  // which must survive. Clearing by category (not by month alone) is what
  // makes that safe, and also drops a category that had money last run but
  // ₪0 this run.
  const knownCategories = [...Object.keys(CATEGORY_TO_DIVISION), PRODUCTS_LABEL, ...unmapped.map((u) => u.category)];
  const { error: deleteError } = await supabase
    .from("rapid_sales_categories")
    .delete()
    .eq("month", month)
    .in("category", knownCategories);
  if (deleteError) throw new Error(`Failed to clear old category rows: ${deleteError.message}`);

  const { error: insertError } = await supabase
    .from("rapid_sales_categories")
    .insert(categoryRows.map((c) => ({ month, category: c.category, division: c.division, amount: c.amount })));
  if (insertError) throw new Error(`Failed to insert category rows: ${insertError.message}`);

  const byDivision = new Map<Division, number>();
  for (const c of categoryRows) {
    if (!c.division) continue;
    byDivision.set(c.division, (byDivision.get(c.division) ?? 0) + c.amount);
  }

  // updated_at only defaults to now() on INSERT -- an upsert hitting an
  // existing row (re-running this for the same month) is an UPDATE, which
  // Postgres leaves the default alone for, so it's set explicitly (same bug
  // class fixed 2026-08-23 in the referrals and budget importers).
  const nowIso = new Date().toISOString();
  const manualEntryRows = [...byDivision].map(([division, value]) => ({
    kind: "rapid_actual" as const,
    month,
    division,
    metric: "revenue_spa_upgrades",
    value,
    updated_at: nowIso,
  }));

  const { error: upsertError } = await supabase
    .from("manual_entries")
    .upsert(manualEntryRows, { onConflict: "kind,month,division,metric" });
  if (upsertError) throw new Error(`Failed to upsert revenue_spa_upgrades: ${upsertError.message}`);

  return { month, categoriesWritten: categoryRows.length, divisionsUpdated: byDivision.size };
}
