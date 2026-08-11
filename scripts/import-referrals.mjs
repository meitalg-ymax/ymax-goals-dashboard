#!/usr/bin/env node
// Imports a Rapid "Treatment Plans Report" export (עסקאות תוכניות טיפול) as
// the real source behind ירוקים/הפניות (referrals) revenue. Confirmed with
// Meital 2026-08-11: this report has NO division column (just date, client,
// plan name, status, planner, sales team, discount, final amount) -- she
// explicitly chose to sum it as ONE company-wide total rather than guess a
// per-division split. It's stored in rapid_sales_categories with
// division=null, same pattern as the general "מוצרים יפה" product-sales row,
// so it flows automatically into the overview's unassigned-category rollup.
//
// Usage: node scripts/import-referrals.mjs "<path to Treatment Plans Report.xlsx>"
//
// Unlike the Rapid SalesReport (one title-row date range = one month), this
// report has a per-row creation date -- rows are grouped by their own month
// and each affected month's ירוקים row is replaced independently, so
// re-running with an updated export only touches the months present in it.

const REFERRALS_CATEGORY = "ירוקים (הפניות)";

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

function isTrue(cell) {
  return String(cell).trim().toLowerCase() === "true";
}

// תאריך יצירה looks like "09/08/2026" (DD/MM/YYYY).
function monthFromDate(cell) {
  const m = String(cell).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, , mm, yyyy] = m;
  return `${yyyy}-${mm}-01`;
}

function parseReport(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Export"];
  if (!ws) throw new Error(`Expected an "Export" sheet, found: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const dataRows = rows.slice(1).filter((r) => r.length && r[0] !== "");

  const byMonth = new Map(); // month -> amount
  let skipped = 0;

  for (const r of dataRows) {
    const [createdAt, , , active, closed, , , , finalAmount] = r;
    if (!isTrue(active) || !isTrue(closed)) {
      skipped++;
      continue;
    }
    const month = monthFromDate(createdAt);
    if (!month) {
      skipped++;
      continue;
    }
    byMonth.set(month, (byMonth.get(month) ?? 0) + (Number(finalAmount) || 0));
  }

  return { byMonth, rowCount: dataRows.length, skipped };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import-referrals.mjs <path-to-Treatment-Plans-Report.xlsx>");
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, "..");
  const env = loadEnv(projectRoot);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { byMonth, rowCount, skipped } = parseReport(filePath);

  console.log(`${rowCount} rows read, ${skipped} skipped (not active+closed, or unparseable date).`);
  console.log("ירוקים by month (company-wide, not split by division):");
  for (const [month, amount] of byMonth) {
    console.log(`  ${month}  ₪${amount.toLocaleString()}`);
  }

  for (const [month, amount] of byMonth) {
    const { error: deleteError } = await supabase
      .from("rapid_sales_categories")
      .delete()
      .eq("month", month)
      .eq("category", REFERRALS_CATEGORY);
    if (deleteError) throw new Error(`Failed to clear old ${month} referrals row: ${deleteError.message}`);

    const { error: insertError } = await supabase
      .from("rapid_sales_categories")
      .insert({ month, category: REFERRALS_CATEGORY, division: null, amount });
    if (insertError) throw new Error(`Failed to insert ${month} referrals row: ${insertError.message}`);
  }

  console.log(`\nDone. ${byMonth.size} month(s) updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
