import { runCoqlAll } from "./coql";
import { andAll } from "./coqlHelpers";
import type { MonthRange } from "./dateRanges";
import { customDateTimeRange } from "./dateRanges";

// tech is a rollup of these `type` values (confirmed methodology). mira dry
// used to roll up into tech too, but is now its own division (2026-08-11) --
// handled separately in transform.ts, not part of this list.
export const TECH_TYPE_VALUES = ["anti aging", "acne", "pigmentation", "post acne"];

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

export function hebrewMonthYearTag(monthDate: Date): string {
  const monthName = HEBREW_MONTHS[monthDate.getUTCMonth()];
  const yy = String(monthDate.getUTCFullYear()).slice(-2);
  return `${monthName} ${yy}`;
}

export type LeadRow = { id: string; Lead_Source?: string; type?: string };

// Lead_Source values that mean "this is actually a mailing-channel lead" --
// excluded from the base leads report so a lead doesn't get double-counted
// there AND in fetchMailingLeadsForMonth (which finds the same leads by Tag,
// not Created_Time, so the two queries can otherwise overlap). Confirmed
// against Meital's own Zoho list-view filter (2026-08-12) -- match hers
// exactly here, don't try to generalize to "contains דיוור".
const MAILING_SOURCE_EXCLUSIONS = ["דיוור - הזרקות", "ymax - דיוור", "נאל", "דיוור וואצאפ", "דיוור - גוף"];

// Leads created this month -- classified ממומן/אורגני/division by Lead_Source
// text (NOT by `type`, per the standing rule). Two COQL-side filters added
// 2026-08-12 to match Meital's own Zoho list-view filter exactly: type must
// be set (a lead with no type at all isn't in her report either, even if
// Lead_Source alone would resolve a division), and the known mailing-source
// values are excluded up front. Division/paid-organic classification itself
// still happens in transform.ts.
function leadsBaseFilters(fromDateTimeStr: string, toDateTimeStr: string): string[] {
  return [
    `Created_Time >= '${fromDateTimeStr}'`,
    `Created_Time <= '${toDateTimeStr}'`,
    `type is not null`,
    ...MAILING_SOURCE_EXCLUSIONS.map((s) => `Lead_Source not like '%${s}%'`),
  ];
}

export async function fetchLeadsForMonth(range: MonthRange): Promise<LeadRow[]> {
  const query = `select id, Lead_Source, type from Leads where ${andAll(
    leadsBaseFilters(range.monthStartDateTimeStr, range.yesterdayEndDateTimeStr)
  )}`;
  return runCoqlAll(query) as Promise<LeadRow[]>;
}

// On-demand report (the "לידים לפי תאריך" tab) -- an arbitrary caller-picked
// range, fetched live on request rather than from the daily zoho_metrics
// sync. Same filters as fetchLeadsForMonth, just not capped at yesterday.
export async function fetchLeadsForDateRange(fromDateStr: string, toDateStr: string): Promise<LeadRow[]> {
  const { fromDateTimeStr, toDateTimeStr } = customDateTimeRange(fromDateStr, toDateStr);
  const query = `select id, Lead_Source, type from Leads where ${andAll(
    leadsBaseFilters(fromDateTimeStr, toDateTimeStr)
  )}`;
  return runCoqlAll(query) as Promise<LeadRow[]>;
}

export type InvalidLeadRow = { id: string; Lead_Source?: string; type?: string; field90?: string };

// The specific "מעקב פניה" (field90) disposition values that count as an
// invalid lead -- NOT simply "field90 is not null", which would also match
// in-progress statuses like "ממתין לשיחת המשך" (waiting for follow-up call).
// Narrowed to these 4 reasons only (confirmed with Meital 2026-08-16) --
// "מרחק", "אין מענה נעלם בתהליך המכירה", and "לא הבינה את הפרסום" no longer
// count as invalid.
const INVALID_LEAD_REASONS = ["אי התאמה לטיפול", "פרטי קשר שגויים", "הועבר לסניף", "מכחיש פניה"];

// Invalid leads: ממומן (marketism) leads only, with one of the specific
// invalid-disposition values in field90.
export async function fetchInvalidLeadsForMonth(range: MonthRange): Promise<InvalidLeadRow[]> {
  const reasonList = INVALID_LEAD_REASONS.map((r) => `'${r}'`).join(",");
  const query = `select id, Lead_Source, type, field90 from Leads where ${andAll([
    `Created_Time >= '${range.monthStartDateTimeStr}'`,
    `Created_Time <= '${range.yesterdayEndDateTimeStr}'`,
    `Lead_Source like '%marketism%'`,
    `field90 in (${reasonList})`,
  ])}`;
  return runCoqlAll(query) as Promise<InvalidLeadRow[]>;
}

export type ArrivalRow = { id: string; Lead_Source?: string; type?: string; Lead_Status?: string; field13?: string };

// Arrivals: either final outcome (not-closed or closed) counts as "showed up",
// filtered on the meeting-time field (field13), current month to yesterday.
export async function fetchArrivalsForMonth(range: MonthRange): Promise<ArrivalRow[]> {
  const query = `select id, Lead_Source, type, Lead_Status, field13 from Leads where ${andAll([
    `Lead_Status in ('1לא נסגר','1נסגרה עסקה')`,
    `field13 >= '${range.monthStartDateTimeStr}'`,
    `field13 <= '${range.yesterdayEndDateTimeStr}'`,
  ])}`;
  return runCoqlAll(query) as Promise<ArrivalRow[]>;
}

export type ClosingRow = {
  id: string;
  Lead_Source?: string;
  type?: string;
  Lead_Status?: string;
  field_16?: string;
  field1234567?: number;
};

// Closings + revenue: closed deals only, filtered on field_16 (plain date,
// not datetime), current month to yesterday. field1234567 (סכום עסקה) is the
// revenue figure summed over these same rows.
export async function fetchClosingsForMonth(range: MonthRange): Promise<ClosingRow[]> {
  const query = `select id, Lead_Source, type, Lead_Status, field_16, field1234567 from Leads where ${andAll(
    [
      `Lead_Status = '1נסגרה עסקה'`,
      `field_16 >= '${range.monthStartDateStr}'`,
      `field_16 <= '${range.yesterdayDateStr}'`,
    ]
  )}`;
  return runCoqlAll(query) as Promise<ClosingRow[]>;
}

export type MailingLeadRow = { id: string; Lead_Source?: string; type?: string; Tag?: unknown };

// Mailing leads: Tag contains "<Hebrew month> <YY>" for the CURRENT month --
// these can have any Created_Time (a recurring mailing list, not new leads).
export async function fetchMailingLeadsForMonth(range: MonthRange): Promise<MailingLeadRow[]> {
  const tag = hebrewMonthYearTag(range.monthDate);
  const query = `select id, Lead_Source, type, Tag from Leads where Tag like '%${tag}%'`;
  return runCoqlAll(query) as Promise<MailingLeadRow[]>;
}
