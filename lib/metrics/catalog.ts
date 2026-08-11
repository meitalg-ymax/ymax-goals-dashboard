// The metric catalog is the single source of truth for what a "target" or
// "rapid_actual" row in manual_entries can be. Both /targets and /rapid use
// this to render their forms and to validate saves -- a typo'd metric key
// fails fast here in TS, not silently in Postgres.
//
// Keys 1-19 mirror the real rows in "יעדים - טופס הזנה חודשי.xlsx" exactly
// (rows 20-22 there are SUM formulas -- computed, never stored, see
// lib/metrics/derive.ts). Metric keys for the ones Zoho also produces
// (leads_funded, arrivals_funded_organic, etc.) match zoho_metrics exactly,
// so יעד-vs-ביצוע is always a same-key lookup across two tables.

export type MetricKind = "target" | "rapid_actual";
export type MetricValueType = "number" | "currency" | "percent";

export type MetricDef = {
  key: string;
  label: string;
  group: string;
  valueType: MetricValueType;
  kinds: MetricKind[];
};

export const TARGET_METRICS: MetricDef[] = [
  {
    key: "budget_funded",
    label: "תקציב ממומן",
    group: "תקציב",
    valueType: "currency",
    kinds: ["target", "rapid_actual"],
  },
  {
    key: "cost_per_lead_funded",
    label: "עלות ליד ממומן",
    group: "תקציב",
    valueType: "currency",
    kinds: ["target"],
  },
  { key: "leads_funded", label: "לידים - ממומן", group: "לידים", valueType: "number", kinds: ["target"] },
  { key: "leads_organic", label: "לידים - אורגני", group: "לידים", valueType: "number", kinds: ["target"] },
  { key: "leads_mailing", label: "לידים - דיוור", group: "לידים", valueType: "number", kinds: ["target"] },

  {
    key: "arrivals_funded_organic",
    label: "הגעות - ממומן+אורגני",
    group: "ממומן+אורגני",
    valueType: "number",
    kinds: ["target"],
  },
  {
    key: "conversion_lead_arrival_funded_organic",
    label: "% המרה ליד→הגעה - ממומן+אורגני",
    group: "ממומן+אורגני",
    valueType: "percent",
    kinds: ["target"],
  },
  {
    key: "closings_funded_organic",
    label: "סגירות - ממומן+אורגני",
    group: "ממומן+אורגני",
    valueType: "number",
    kinds: ["target"],
  },
  {
    key: "conversion_arrival_closing_funded_organic",
    label: "% סגירה - ממומן+אורגני",
    group: "ממומן+אורגני",
    valueType: "percent",
    kinds: ["target"],
  },
  {
    key: "revenue_funded_organic",
    label: "הכנסות - ממומן+אורגני",
    group: "ממומן+אורגני",
    valueType: "currency",
    kinds: ["target"],
  },
  {
    key: "avg_deal_value_funded_organic",
    label: "שווי עסקה ממוצע - ממומן+אורגני",
    group: "ממומן+אורגני",
    valueType: "currency",
    kinds: ["target"],
  },

  {
    key: "arrivals_mailing",
    label: "הגעות - דיוור",
    group: "דיוור",
    valueType: "number",
    kinds: ["target"],
  },
  {
    key: "conversion_lead_arrival_mailing",
    label: "% המרה ליד→הגעה - דיוור",
    group: "דיוור",
    valueType: "percent",
    kinds: ["target"],
  },
  { key: "closings_mailing", label: "סגירות - דיוור", group: "דיוור", valueType: "number", kinds: ["target"] },
  {
    key: "conversion_arrival_closing_mailing",
    label: "% סגירה - דיוור",
    group: "דיוור",
    valueType: "percent",
    kinds: ["target"],
  },
  { key: "revenue_mailing", label: "הכנסות - דיוור", group: "דיוור", valueType: "currency", kinds: ["target"] },
  {
    key: "avg_deal_value_mailing",
    label: "שווי עסקה ממוצע - דיוור",
    group: "דיוור",
    valueType: "currency",
    kinds: ["target"],
  },

  {
    key: "revenue_spa_upgrades",
    label: "הכנסות - ספה ושדרוגים",
    group: "הכנסות נוספות (ראפיד)",
    valueType: "currency",
    kinds: ["target", "rapid_actual"],
  },
  {
    // Actual referral revenue is sourced automatically company-wide from the
    // Rapid "Treatment Plans Report" (scripts/import-referrals.mjs) -- the
    // report has no division column, and Meital confirmed (2026-08-11) to
    // sum it as one total rather than guess a per-division split. Only the
    // target stays a per-division manual input; there's no rapid_actual kind.
    key: "revenue_referrals",
    label: "הכנסות - ירוקים (הפניות)",
    group: "הכנסות נוספות (ראפיד)",
    valueType: "currency",
    kinds: ["target"],
  },
];

export function metricsForKind(kind: MetricKind): MetricDef[] {
  return TARGET_METRICS.filter((m) => m.kinds.includes(kind));
}

export function groupsForKind(kind: MetricKind): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const m of metricsForKind(kind)) {
    if (!seen.has(m.group)) {
      seen.add(m.group);
      groups.push(m.group);
    }
  }
  return groups;
}
