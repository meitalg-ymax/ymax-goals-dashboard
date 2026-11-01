import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyBranch, type Branch, type Division } from "@/lib/zoho/transform";

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
export type BranchRevenueRow = { branch: Branch; amount: number };
export type BranchRepRevenueRow = { branch: Branch; rep: string; amount: number };
export type RepDivision = Division | "products" | "other";
export type BranchRepDivisionRevenueRow = { branch: Branch; rep: string; division: RepDivision; amount: number };
export type ParsedRapidSales = {
  month: string;
  categoryRows: CategoryRow[];
  unmapped: { category: string; amount: number }[];
  branchRows: BranchRevenueRow[];
  branchRepRows: BranchRepRevenueRow[];
  branchRepDivisionRows: BranchRepDivisionRevenueRow[];
  // false when the source has no consultant names -- the per-rep tables are
  // then left as they are rather than cleared.
  hasReps: boolean;
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
  const lines: SaleLine[] = dataRows.map((r) => ({
    category: String(r[2]),
    total: Number(r[15]) || 0,
    branchName: String(r[0]),
    rep: String(r[12] ?? "").trim(),
  }));
  return { month, ...aggregateSaleLines(lines), hasReps: true, rowCount: dataRows.length };
}

// Rapid's automatic daily email "דו"ח מכירות אווטומאטי" (DynamicReport_*.xlsx,
// sheet "Export"): same document lines as SalesReport but with raw column
// names -- month-to-date through yesterday, so the one sent on the 1st is
// the previous month's full report. Verified 2026-11-01 against
// SalesReport-29-10-2026 for 01-28/10: TotalWithVat summed per
// ItemCategoryName matched SalesReport's סה"כ per קטגוריה to the shekel,
// once SYSTEM_ITEMS (₪0 quote placeholders plus a few system lines that
// SalesReport hides) is dropped. Branches come as BranchId only, mapped
// below by matching those same per-branch totals.
//
// Consultants (SalesMembers) are user GUIDs, not names, so this format
// can't feed the per-rep tables -- hasReps=false leaves them as the last
// SalesReport upload wrote them instead of overwriting with GUIDs.
const DYNAMIC_BRANCH_NAMES: Record<string, string> = {
  "1": 'יפה מקסימוב ראשל"צ',
  "2": 'יפה מקסימוב ר"ג',
  "4": "יפה מקסימוב ירושלים",
};

export function parseRapidDynamicSalesReport(buffer: Buffer): ParsedRapidSales {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets["Export"];
  if (!ws) throw new Error(`Expected an "Export" sheet, found: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as unknown[][];
  const header = rows[0] as string[];
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Missing column "${name}" in header: ${JSON.stringify(header)}`);
    return i;
  };
  const dateCol = col("DocDate");
  const categoryCol = col("ItemCategoryName");
  const totalCol = col("TotalWithVat");
  const branchCol = col("BranchId");

  const dated = rows.slice(1).flatMap((r) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(r[dateCol]));
    return m ? [{ r, month: `${m[3]}-${m[2]}-01` }] : [];
  });
  if (dated.length === 0) throw new Error("Report has no dated rows");

  // One report = one month; if it ever straddles two, keep the later one.
  const month = dated.reduce((a, x) => (x.month > a ? x.month : a), dated[0].month);
  const lines: SaleLine[] = dated
    .filter((x) => x.month === month && String(x.r[categoryCol]) !== "SYSTEM_ITEMS")
    .map(({ r }) => {
      const branchId = String(r[branchCol]);
      const branchName = DYNAMIC_BRANCH_NAMES[branchId];
      if (!branchName) throw new Error(`Unknown BranchId "${branchId}" -- add it to DYNAMIC_BRANCH_NAMES`);
      return { category: String(r[categoryCol]), total: Number(r[totalCol]) || 0, branchName, rep: "" };
    });
  return { month, ...aggregateSaleLines(lines), hasReps: false, rowCount: lines.length };
}

type SaleLine = { category: string; total: number; branchName: string; rep: string };

function aggregateSaleLines(lines: SaleLine[]) {
  const rawTotals = new Map<string, number>();
  const rawBranchTotals = new Map<Branch, number>();
  // branch+rep (צוות מכירות) -- a separate cross-section of the
  // same report, purely for cross-referencing against zoho_branch_rep_metrics
  // in the UI. Rows with no rep set aren't attributed to anyone here (mirrors
  // how zoho_branch_rep_metrics leaves unassigned rows out and lets the UI
  // derive the "unassigned" remainder instead).
  const rawBranchRepTotals = new Map<string, number>();
  // branch+rep+division -- same rows as rawBranchRepTotals, additionally
  // split by category->division for the "יועצות" tab. Products and unmapped
  // categories get their own buckets so per-rep sums still match the above.
  const rawBranchRepDivisionTotals = new Map<string, number>();
  for (const { category, total, branchName, rep } of lines) {
    rawTotals.set(category, (rawTotals.get(category) ?? 0) + total);

    const branch = classifyBranch(branchName);
    if (branch) {
      rawBranchTotals.set(branch, (rawBranchTotals.get(branch) ?? 0) + total);

      if (rep) {
        const key = `${branch}||${rep}`;
        rawBranchRepTotals.set(key, (rawBranchRepTotals.get(key) ?? 0) + total);

        const division: RepDivision = PRODUCT_CATEGORIES.includes(category)
          ? "products"
          : (CATEGORY_TO_DIVISION[category] ?? "other");
        const divKey = `${branch}||${rep}||${division}`;
        rawBranchRepDivisionTotals.set(divKey, (rawBranchRepDivisionTotals.get(divKey) ?? 0) + total);
      }
    }
  }
  const branchRows: BranchRevenueRow[] = [...rawBranchTotals].map(([branch, amount]) => ({ branch, amount }));
  const branchRepRows: BranchRepRevenueRow[] = [...rawBranchRepTotals].map(([key, amount]) => {
    const [branch, rep] = key.split("||") as [Branch, string];
    return { branch, rep, amount };
  });
  const branchRepDivisionRows: BranchRepDivisionRevenueRow[] = [...rawBranchRepDivisionTotals].map(([key, amount]) => {
    const [branch, rep, division] = key.split("||") as [Branch, string, RepDivision];
    return { branch, rep, division, amount };
  });

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

  return { categoryRows, unmapped, branchRows, branchRepRows, branchRepDivisionRows };
}

export async function applyRapidSalesImport(supabase: SupabaseClient, parsed: ParsedRapidSales) {
  const { month, categoryRows, unmapped, branchRows, branchRepRows, branchRepDivisionRows, hasReps } = parsed;

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

  // rapid_sales_by_branch is exclusively owned by this importer (unlike
  // rapid_sales_categories, nothing else writes into it), so a full
  // delete-then-insert for the month is safe -- no risk of clobbering
  // another importer's rows.
  const { error: branchDeleteError } = await supabase.from("rapid_sales_by_branch").delete().eq("month", month);
  if (branchDeleteError) throw new Error(`Failed to clear old branch rows: ${branchDeleteError.message}`);
  if (branchRows.length > 0) {
    const { error: branchInsertError } = await supabase
      .from("rapid_sales_by_branch")
      .insert(branchRows.map((b) => ({ month, branch: b.branch, amount: b.amount })));
    if (branchInsertError) throw new Error(`Failed to insert branch rows: ${branchInsertError.message}`);
  }

  if (hasReps) {
    // rapid_sales_by_branch_rep is exclusively owned by this importer too --
    // same full delete-then-insert-for-the-month approach as rapid_sales_by_branch.
    const { error: branchRepDeleteError } = await supabase.from("rapid_sales_by_branch_rep").delete().eq("month", month);
    if (branchRepDeleteError) throw new Error(`Failed to clear old branch-rep rows: ${branchRepDeleteError.message}`);
    if (branchRepRows.length > 0) {
      const { error: branchRepInsertError } = await supabase
        .from("rapid_sales_by_branch_rep")
        .insert(branchRepRows.map((b) => ({ month, branch: b.branch, rep: b.rep, amount: b.amount })));
      if (branchRepInsertError) throw new Error(`Failed to insert branch-rep rows: ${branchRepInsertError.message}`);
    }

    // rapid_sales_by_branch_rep_division -- also exclusively owned by this
    // importer, same full delete-then-insert-for-the-month approach.
    const { error: repDivDeleteError } = await supabase
      .from("rapid_sales_by_branch_rep_division")
      .delete()
      .eq("month", month);
    if (repDivDeleteError) throw new Error(`Failed to clear old rep-division rows: ${repDivDeleteError.message}`);
    if (branchRepDivisionRows.length > 0) {
      const { error: repDivInsertError } = await supabase
        .from("rapid_sales_by_branch_rep_division")
        .insert(branchRepDivisionRows.map((b) => ({ month, branch: b.branch, rep: b.rep, division: b.division, amount: b.amount })));
      if (repDivInsertError) throw new Error(`Failed to insert rep-division rows: ${repDivInsertError.message}`);
    }
  }

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

  return {
    month,
    categoriesWritten: categoryRows.length,
    divisionsUpdated: byDivision.size,
    branchesWritten: branchRows.length,
    branchRepsWritten: branchRepRows.length,
    branchRepDivisionsWritten: branchRepDivisionRows.length,
  };
}
