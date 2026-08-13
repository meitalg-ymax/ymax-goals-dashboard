#!/usr/bin/env node
// Imports a "Treatment Plans Report" export (quote proposals created by the
// referrals coordinator) into Supabase as the ירוקים (הפניות) actual for a
// month. The report has no division column at all -- every row is just a
// customer + a closed quote -- so, like "מוצרים יפה", this lands as one
// company-wide row in rapid_sales_categories (division=null), not split per
// division.
//
// Usage: node scripts/import-rapid-referrals.mjs "<path to Treatment Plans Report.xlsx>" [YYYY-MM]
// Month defaults to the current month if omitted. Only rows whose תאריך יצירה
// falls in that month AND סגורה=True count -- an open/unclosed quote isn't
// realized revenue yet.
//
// Sums תקבולים (amount actually RECEIVED so far), not סך הכל לאחר הנחה (the
// full closed deal value) -- a closed deal can be paid in installments, so
// the deal total can overstate what's actually landed this month (confirmed
// with Meital 2026-08-12, e.g. a ₪4,200 deal with only ₪1,000 תקבולים).
// Falls back to סך הכל לאחר הנחה for older report exports that predate the
// תקבולים column.
const REFERRALS_LABEL = "ירוקים (הפניות)";

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

function isTruthy(v) {
  return v === true || v === "True" || v === "TRUE" || v === 1;
}

// תאריך יצירה is 'DD/MM/YYYY' text.
function rowMonth(dateStr) {
  const m = String(dateStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, , mm, yyyy] = m;
  return `${yyyy}-${mm}`;
}

function parseReport(filePath, targetMonth) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Export"];
  if (!ws) throw new Error(`Expected an "Export" sheet, found: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const header = rows[0];
  const dataRows = rows.slice(1).filter((r) => r.length && r[0] !== "");

  const dateCol = header.indexOf("תאריך יצירה");
  const closedCol = header.indexOf("סגורה");
  const receivedCol = header.indexOf("תקבולים");
  const totalCol = header.indexOf("סך הכל לאחר הנחה");
  const amountCol = receivedCol !== -1 ? receivedCol : totalCol;
  if (dateCol === -1 || closedCol === -1 || amountCol === -1) {
    throw new Error(`Unexpected header, missing a required column: ${JSON.stringify(header)}`);
  }
  const amountSource = receivedCol !== -1 ? "תקבולים" : "סך הכל לאחר הנחה (fallback, no תקבולים column found)";

  let amount = 0;
  let includedCount = 0;
  const excluded = { otherMonth: 0, notClosed: 0 };

  for (const r of dataRows) {
    if (rowMonth(r[dateCol]) !== targetMonth) {
      excluded.otherMonth++;
      continue;
    }
    if (!isTruthy(r[closedCol])) {
      excluded.notClosed++;
      continue;
    }
    amount += Number(r[amountCol]) || 0;
    includedCount++;
  }

  return { amount, includedCount, excluded, totalRows: dataRows.length, amountSource };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/import-rapid-referrals.mjs <path-to-Treatment-Plans-Report.xlsx> [YYYY-MM]");
    process.exit(1);
  }
  const targetMonth = process.argv[3] ?? new Date().toISOString().slice(0, 7);
  const month = `${targetMonth}-01`;

  const projectRoot = path.join(__dirname, "..");
  const env = loadEnv(projectRoot);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { amount, includedCount, excluded, totalRows, amountSource } = parseReport(filePath, targetMonth);

  console.log(`Target month: ${targetMonth}`);
  console.log(`Amount column: ${amountSource}`);
  console.log(`${totalRows} rows total -- ${includedCount} included, ${excluded.otherMonth} from other months, ${excluded.notClosed} not closed.`);
  console.log(`ירוקים (הפניות) total: ₪${amount.toLocaleString()}`);

  const { error } = await supabase
    .from("rapid_sales_categories")
    .upsert({ month, category: REFERRALS_LABEL, division: null, amount }, { onConflict: "month,category" });
  if (error) throw new Error(`Failed to upsert referrals row: ${error.message}`);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
