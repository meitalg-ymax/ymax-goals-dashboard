import type { Division } from "@/lib/zoho/transform";

// Meital's live budget/leads tracker: a Google Sheet with one continuous tab
// ("מעקב יומי") pre-filled with a row per calendar day (through the end of
// next year) and a "<Hebrew month> <year>" divider row before each month's
// days. Some external automation on her side fills in that day's row once
// the day's ad spend is known -- unfilled days are blank, not zero. We only
// read the "תקציב מצטבר מתחילת החודש" (cumulative budget spent so far this
// month) column per division and treat the latest filled day as the current
// ניצול תקציב actual. Leads already come live from Zoho, so we deliberately
// don't import this sheet's leads columns -- that would create two competing
// sources of truth for the same number (the exact bug class already hit
// twice this session, see budgetActual-only note below).
//
// The sheet is shared "anyone with the link can view", so its CSV export URL
// (?format=csv&gid=...) is fetchable with no OAuth at all -- see
// BUDGET_SHEET_ID / BUDGET_SHEET_GID in .env.local.
const DIVISION_LABELS: Record<string, Division> = {
  YMAX: "ymax",
  הזרקות: "doctor",
  "טכנולוגי (אקנה)": "tech",
  גוף: "body",
  "מירה דריי": "mira_dry",
};

// 0-indexed column holding "תקציב מצטבר מתחילת החודש (₪)" for each division's
// 4-column block (...cumulative budget, today's spend, cumulative leads,
// today's leads). Column 0 is the date.
const DIVISION_BUDGET_COLUMN: Record<Division, number> = {
  ymax: 1,
  doctor: 5,
  tech: 9,
  body: 13,
  mira_dry: 17,
};

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function budgetSheetMonthLabel(date: Date): string {
  return `${HEBREW_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const DATE_ROW_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

// Minimal RFC4180 CSV parser (quoted fields, "" as an escaped quote, commas
// and newlines inside quotes preserved) -- Google's CSV export needs this: a
// naive split(",") would break on "₪144,896", and the header row's cells
// contain literal newlines (e.g. "תקציב מצטבר\nמתחילת החודש (₪)").
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

function parseRowDate(label: string): Date | null {
  const m = DATE_ROW_PATTERN.exec(label.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

export type BudgetRow = { division: Division; budgetActual: number };

// Full row width: date + 5 divisions * 4 columns + 4 total columns.
const EXPECTED_ROW_WIDTH = 1 + 5 * 4 + 4;
// The sheet's template is pre-filled through end of next year -- if a fetch
// comes back without reaching that far, the response was cut short (seen in
// practice: a truncated Google CSV export silently drops the tail of a row,
// which without this check reads as "not filled in yet" and freezes that
// division's value at whatever it was last time, real bug caught 2026-09-17).
const COMPLETENESS_MARKER = "דצמבר 2027";

// Reads the current month's block of daily rows and, per division, returns
// the "תקציב מצטבר מתחילת החודש" value from the latest day that has been
// filled in (blank future/unfilled days are skipped, not treated as zero).
// A division with no filled days yet this month comes back as 0 -- that's a
// legitimate "nothing spent yet", not a layout error.
export function parseDailyBudgetSheet(csvText: string, asOf: Date): BudgetRow[] {
  const rows = parseCsv(csvText);

  if (!rows.some((r) => (r[0] ?? "").trim() === COMPLETENESS_MARKER)) {
    throw new Error(
      `Budget sheet fetch looks incomplete -- missing the "${COMPLETENESS_MARKER}" marker row near the end of the template. Aborting rather than writing possibly-truncated data.`
    );
  }

  const monthLabel = budgetSheetMonthLabel(asOf);
  const monthRowIdx = rows.findIndex((r) => (r[0] ?? "").trim() === monthLabel);
  if (monthRowIdx === -1) {
    throw new Error(`Could not find the "${monthLabel}" month row -- sheet layout may have changed.`);
  }

  const latestByDivision: Partial<Record<Division, number>> = {};

  for (let i = monthRowIdx + 1; i < rows.length; i++) {
    const rowDate = parseRowDate(rows[i][0] ?? "");
    if (!rowDate) break; // hit the next month's divider row (or EOF)
    if (rowDate.getTime() > asOf.getTime()) continue; // don't read ahead of today

    if (rows[i].length < EXPECTED_ROW_WIDTH) {
      throw new Error(
        `Row for ${rows[i][0]} has only ${rows[i].length} columns (expected ${EXPECTED_ROW_WIDTH}) -- fetch looks truncated. Aborting rather than writing partial data.`
      );
    }

    for (const division of Object.keys(DIVISION_BUDGET_COLUMN) as Division[]) {
      const cell = (rows[i][DIVISION_BUDGET_COLUMN[division]] ?? "").trim();
      if (cell === "") continue; // day not filled in yet for this division
      latestByDivision[division] = parseCurrency(cell);
    }
  }

  return Object.values(DIVISION_LABELS).map((division) => ({
    division,
    budgetActual: latestByDivision[division] ?? 0,
  }));
}
