import { TECH_TYPE_VALUES } from "./queries";
import type { LeadRow, InvalidLeadRow, ArrivalRow, ClosingRow, MailingLeadRow } from "./queries";

export type Division = "ymax" | "body" | "tech" | "doctor" | "mira_dry";
export const DIVISIONS: Division[] = ["ymax", "body", "tech", "doctor", "mira_dry"];

export type MetricRow = { division: Division; metric: string; value: number };
export type ReasonRow = { division: Division; reason: string; count: number };

// Leads are classified by Lead_Source TEXT (not `type`) -- confirmed rule:
// "רק לידים תספור לפי מקור ליד, והשאר לפי TYPE".
// ig_linktree override (confirmed 2026-08-11): a source containing
// "ig_linktree" is organic even if it also contains "marketism" -- check
// this BEFORE the general marketism check.
export function classifyPaidOrganic(source: string | undefined): "paid" | "organic" {
  const s = (source ?? "").toLowerCase();
  if (s.includes("ig_linktree")) return "organic";
  if (s.includes("marketism")) return "paid";
  return "organic";
}

// Division from Lead_Source text -- used only for the leads count itself.
// Many organic sources (WEBSITE, direct calls, etc.) don't name a division;
// those fold into the company-wide organic total but attribute to no
// specific division row (matches the "31 unclassified leads" note).
function divisionFromSourceText(source: string | undefined): Division | null {
  const s = (source ?? "").toLowerCase();
  if (s.includes("mira dry")) return "mira_dry";
  if (s.includes("ymax")) return "ymax";
  if (s.includes("doctor")) return "doctor";
  if (s.includes("tech")) return "tech";
  if (s.includes("body")) return "body";
  return null;
}

// Paid (marketism) campaigns are always named per-division in Lead_Source
// ("marketism ymax facebook", "marketism doctors facebook"), so source text
// is reliable there. Organic/direct sources (WEBSITE, "שיחה נכנסת - מנהל",
// Facebook, Instagram, referrals) are generic across the whole business and
// essentially NEVER name a division -- confirmed by checking real organic
// doctor/tech/body leads, none of which mention their division in the text.
// `type` is otherwise unreliable for division (mistagged records is exactly
// why leads use source text at all for the paid case), but for the organic
// case it's the only signal available, so it's used as a fallback whenever
// source text doesn't resolve a division.
export function classifyDivisionFromSource(source: string | undefined, type?: string): Division | null {
  return divisionFromSourceText(source) ?? classifyDivisionFromType(type);
}

// Division from the `type` field -- used for every metric EXCEPT the leads
// count (invalid leads, arrivals, closings, revenue). tech is a rollup of
// several type values (TECH_TYPE_VALUES); mira dry is its own division, no
// longer folded into tech (confirmed 2026-08-11).
export function classifyDivisionFromType(type: string | undefined): Division | null {
  const t = (type ?? "").toLowerCase().trim();
  if (t === "mira dry") return "mira_dry";
  if (TECH_TYPE_VALUES.includes(t)) return "tech";
  // "body tech" is a malformed picklist value that shows up in real Zoho data
  // (confirmed 2026-08-16, 20 leads since June) -- should be a single clean
  // value, but until it's fixed at the source, map it to tech so these leads
  // aren't silently dropped from every division's numbers.
  if (t === "body tech") return "tech";
  if (t === "ymax") return "ymax";
  if (t === "body") return "body";
  if (t === "doctor") return "doctor";
  return null;
}

// Mailing-channel flag for arrivals/closings/revenue -- a DIFFERENT check
// than the leads paid/organic split (this one looks for "דיוור" in the
// source text, not "marketism"/"ig_linktree").
export function isMailingSource(source: string | undefined): boolean {
  return (source ?? "").includes("דיוור");
}

export function aggregateLeads(rows: LeadRow[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const division of DIVISIONS) {
    let paid = 0;
    let organic = 0;
    for (const row of rows) {
      if (classifyDivisionFromSource(row.Lead_Source, row.type) !== division) continue;
      if (classifyPaidOrganic(row.Lead_Source) === "paid") paid++;
      else organic++;
    }
    out.push({ division, metric: "leads_funded", value: paid });
    out.push({ division, metric: "leads_organic", value: organic });
  }
  return out;
}

export function aggregateInvalidLeads(rows: InvalidLeadRow[]): {
  metrics: MetricRow[];
  reasons: ReasonRow[];
} {
  const metrics: MetricRow[] = [];
  const reasonCounts = new Map<string, Map<string, number>>();

  for (const division of DIVISIONS) {
    const divisionRows = rows.filter((r) => classifyDivisionFromType(r.type) === division);
    metrics.push({ division, metric: "invalid_leads_funded", value: divisionRows.length });

    const reasonMap = new Map<string, number>();
    for (const row of divisionRows) {
      const reason = row.field90 ?? "";
      if (!reason) continue;
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
    }
    reasonCounts.set(division, reasonMap);
  }

  const reasons: ReasonRow[] = [];
  for (const [division, reasonMap] of reasonCounts) {
    for (const [reason, count] of reasonMap) {
      reasons.push({ division: division as Division, reason, count });
    }
  }

  return { metrics, reasons };
}

export function aggregateArrivals(rows: ArrivalRow[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const division of DIVISIONS) {
    const divisionRows = rows.filter((r) => classifyDivisionFromType(r.type) === division);
    const mailing = divisionRows.filter((r) => isMailingSource(r.Lead_Source));
    const fundedOrganic = divisionRows.filter((r) => !isMailingSource(r.Lead_Source));
    // Split funded/organic within the funded+organic cohort -- same
    // classifyPaidOrganic rule used for leads, applied here to Lead_Source
    // on the arrival record itself (available on every row already).
    const funded = fundedOrganic.filter((r) => classifyPaidOrganic(r.Lead_Source) === "paid");
    const organic = fundedOrganic.filter((r) => classifyPaidOrganic(r.Lead_Source) === "organic");

    out.push({ division, metric: "arrivals_funded_organic", value: fundedOrganic.length });
    out.push({ division, metric: "arrivals_funded", value: funded.length });
    out.push({ division, metric: "arrivals_organic", value: organic.length });
    out.push({ division, metric: "arrivals_mailing", value: mailing.length });
  }
  return out;
}

export function aggregateClosingsAndRevenue(rows: ClosingRow[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const division of DIVISIONS) {
    const divisionRows = rows.filter((r) => classifyDivisionFromType(r.type) === division);
    const mailingRows = divisionRows.filter((r) => isMailingSource(r.Lead_Source));
    const fundedOrganicRows = divisionRows.filter((r) => !isMailingSource(r.Lead_Source));
    const fundedRows = fundedOrganicRows.filter((r) => classifyPaidOrganic(r.Lead_Source) === "paid");
    const organicRows = fundedOrganicRows.filter((r) => classifyPaidOrganic(r.Lead_Source) === "organic");

    out.push({ division, metric: "closings_funded_organic", value: fundedOrganicRows.length });
    out.push({ division, metric: "closings_funded", value: fundedRows.length });
    out.push({ division, metric: "closings_organic", value: organicRows.length });
    out.push({ division, metric: "closings_mailing", value: mailingRows.length });

    const sum = (arr: ClosingRow[]) => arr.reduce((acc, r) => acc + (r.field1234567 ?? 0), 0);
    out.push({ division, metric: "revenue_funded_organic", value: sum(fundedOrganicRows) });
    out.push({ division, metric: "revenue_funded", value: sum(fundedRows) });
    out.push({ division, metric: "revenue_organic", value: sum(organicRows) });
    out.push({ division, metric: "revenue_mailing", value: sum(mailingRows) });
  }
  return out;
}

// Mailing leads use Tag (not Created_Time), so they're a separate metric
// from leads_funded/leads_organic above, division still by Lead_Source text
// (Tag content isn't a reliable division signal -- e.g. a "לגוף" tag can sit
// on a type=doctor record).
export function aggregateMailingLeads(rows: MailingLeadRow[]): MetricRow[] {
  const out: MetricRow[] = [];
  for (const division of DIVISIONS) {
    const count = rows.filter((r) => classifyDivisionFromSource(r.Lead_Source, r.type) === division).length;
    out.push({ division, metric: "leads_mailing", value: count });
  }
  return out;
}
