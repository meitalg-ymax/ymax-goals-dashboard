import type { Division } from "@/lib/zoho/transform";

// Meital keeps a live Google Sheet ("budget/leads tracker") with a section
// titled "פירוט ממומן" -- one row per division with תקציב שהוגדר (target,
// already covered by the /targets manual entry) and ניצול תקציב (budget
// ACTUALLY spent so far this month, which we have no other source for).
// The sheet also recomputes leads/קד"ב itself, but we deliberately only
// import the budget-actual column -- leads already come live from Zoho, and
// importing a second copy would create two competing sources of truth for
// the same number (the exact bug class already hit twice this session).
//
// The sheet is shared "anyone with the link can view", so its CSV export
// URL (?format=csv&gid=...) is fetchable with no OAuth at all -- see
// BUDGET_SHEET_CSV_URL in .env.local.
const DIVISION_LABELS: Record<string, Division> = {
  YMAX: "ymax",
  הזרקות: "doctor",
  "טכנולוגי (אקנה)": "tech",
  גוף: "body",
  "מירה דריי": "mira_dry",
};

const HEADER_MARKER = "סוג";
const TOTAL_MARKER_PREFIX = "סה";
// ["סוג", "תקציב שהוגדר", "% ניצול תקציב", "ניצול תקציב", ...] -- 0-indexed.
const BUDGET_ACTUAL_COLUMN = 3;

export type BudgetRow = { division: Division; budgetActual: number };

// Minimal RFC4180 CSV parser (quoted fields, "" as an escaped quote, commas
// inside quotes preserved) -- Google's CSV export needs this, a naive
// split(",") would break on "₪144,896".
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCurrency(s: string | undefined): number {
  const cleaned = (s ?? "").replace(/[₪,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseBudgetSheet(csvText: string): BudgetRow[] {
  const rows = parseCsv(csvText);
  const headerIdx = rows.findIndex((r) => (r[0] ?? "").trim() === HEADER_MARKER);
  if (headerIdx === -1) {
    throw new Error(`Could not find the "${HEADER_MARKER}" header row -- sheet layout may have changed.`);
  }

  const result: BudgetRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const label = (rows[i][0] ?? "").trim();
    if (!label) continue;
    if (label.startsWith(TOTAL_MARKER_PREFIX)) break; // hit the סה"כ total row -- stop
    const division = DIVISION_LABELS[label];
    if (!division) continue; // unrecognized row, skip rather than guess
    result.push({ division, budgetActual: parseCurrency(rows[i][BUDGET_ACTUAL_COLUMN]) });
  }

  if (result.length === 0) {
    throw new Error("No recognized division rows found under the header -- sheet layout may have changed.");
  }
  return result;
}
