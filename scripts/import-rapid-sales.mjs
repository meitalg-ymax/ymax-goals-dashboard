#!/usr/bin/env node
// Imports a Rapid POS "SalesReport" export (general clinic revenue -- hair
// removal, injections, tech treatments, MiraDry, and clinic products) into
// Supabase. This is the real source behind revenue_spa_upgrades: it REPLACES
// whatever was manually typed into the "/rapid" screen for that metric/month,
// for every division found in the report. It also stores the full raw
// category breakdown in rapid_sales_categories so the dashboard overview can
// show "money by category", not just the 5-division rollup.
//
// Usage: node scripts/import-rapid-sales.mjs "<path to SalesReport-*.xlsx>"
//
// The report's own title row ("מתאריך:[01/08/2026] עד:[31/08/2026]") decides
// which month gets replaced -- not today's date -- so this is safe to run for
// a past month's corrected report too.
//
// קטגוריה (raw report category) -> division mapping. Confirmed with Meital
// 2026-08-11. "מוצרים יפה מקסימוב" and "מוצרים ותכשירים" are general product
// sales that don't belong to any division's funnel -- merged into one
// "מוצרים יפה" row with division=null, shown only in the overview.
const CATEGORY_TO_DIVISION = {
  "YMAX PRO הסרת שיער": "ymax",
  "YMAX הסרת שיער פנים": "ymax",
  "הסרת שיער גוף PRO": "body",
  "הסרת שיער גוף": "body",
  "טיפולים טכנולוגיים": "tech",
  "הזרקות": "doctor",
  "טיפול בהזעת יתר": "mira_dry",
};
const PRODUCT_CATEGORIES = ["מוצרים יפה מקסימוב", "מוצרים ותכשירים"];
const PRODUCTS_LABEL = "מוצרים יפה";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(projectRoot) {
  const content = fs.readFileSync(path.join(projectRoot, ".env.local"), "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

// Title row looks like: 'דוח מכירות מנפיק:[...] מתאריך:[01/08/2026] עד:[31/08/2026], סניפים:[כולם]'
function monthFromTitle(title) {
  const m = title.match(/מתאריך:\[(\d{2})\/(\d{2})\/(\d{4})\]/);
  if (!m) return null;
  const [, , mm, yyyy] = m;
  return `${yyyy}-${mm}-01`;
}

function parseReport(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["SalesReport"];
  if (!ws) throw new Error(`Expected a "SalesReport" sheet, found: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const month = monthFromTitle(String(rows[0][0]));
  if (!month) throw new Error(`Could not parse date range from title row: ${rows[0][0]}`);

  const dataRows = rows.slice(3).filter((r) => r.length && r[0] !== "");

  const rawTotals = new Map(); // raw קטגוריה -> sum
  for (const r of dataRows) {
    const category = r[2];
    const total = Number(r[15]) || 0;
    rawTotals.set(category, (rawTotals.get(category) ?? 0) + total);
  }

  const categoryRows = []; // { category, division, amount }
  const unmapped = [];
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

  return { month, categoryRows, unmapped, rowCount: dataRows.length };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import-rapid-sales.mjs <path-to-SalesReport.xlsx>");
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, "..");
  const env = loadEnv(projectRoot);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { month, categoryRows, unmapped, rowCount } = parseReport(filePath);

  console.log(`Report month: ${month} (${rowCount} line items)`);
  console.log("Categories:");
  for (const c of categoryRows) {
    console.log(`  ${c.category.padEnd(24)} ${c.division ?? "(no division)"} \t₪${c.amount.toLocaleString()}`);
  }
  if (unmapped.length > 0) {
    console.warn("\n⚠ UNMAPPED categories found -- not attributed to any division, review CATEGORY_TO_DIVISION:");
    for (const u of unmapped) {
      console.warn(`  ${u.category} \t₪${u.amount.toLocaleString()}`);
      categoryRows.push({ category: u.category, division: null, amount: u.amount });
    }
  }

  // Full replace for the month: clear old rows first so a category that
  // disappeared between runs doesn't linger.
  const { error: deleteError } = await supabase.from("rapid_sales_categories").delete().eq("month", month);
  if (deleteError) throw new Error(`Failed to clear old category rows: ${deleteError.message}`);

  const { error: insertError } = await supabase.from("rapid_sales_categories").insert(
    categoryRows.map((c) => ({ month, category: c.category, division: c.division, amount: c.amount }))
  );
  if (insertError) throw new Error(`Failed to insert category rows: ${insertError.message}`);

  const byDivision = new Map();
  for (const c of categoryRows) {
    if (!c.division) continue;
    byDivision.set(c.division, (byDivision.get(c.division) ?? 0) + c.amount);
  }

  const manualEntryRows = [...byDivision].map(([division, value]) => ({
    kind: "rapid_actual",
    month,
    division,
    metric: "revenue_spa_upgrades",
    value,
  }));

  const { error: upsertError } = await supabase
    .from("manual_entries")
    .upsert(manualEntryRows, { onConflict: "kind,month,division,metric" });
  if (upsertError) throw new Error(`Failed to upsert revenue_spa_upgrades: ${upsertError.message}`);

  console.log("\nrevenue_spa_upgrades (rapid_actual) replaced for:");
  for (const [division, value] of byDivision) {
    console.log(`  ${division.padEnd(10)} ₪${value.toLocaleString()}`);
  }
  console.log(`\nDone. ${categoryRows.length} category rows, ${manualEntryRows.length} divisions updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
