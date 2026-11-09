import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, BRANCHES, CHANNELS, type Division, type Branch, type Channel } from "@/lib/zoho/transform";
import { workDaysBetween } from "@/lib/zoho/dateRanges";

export type DivisionMetrics = {
  leads_funded: number;
  leads_organic: number;
  leads_mailing: number;
  invalid_leads_funded: number;
  arrivals_funded_organic: number;
  arrivals_funded: number;
  arrivals_organic: number;
  arrivals_mailing: number;
  coordinations_funded_organic: number;
  coordinations_funded: number;
  coordinations_organic: number;
  coordinations_mailing: number;
  closings_funded_organic: number;
  closings_funded: number;
  closings_organic: number;
  closings_mailing: number;
  revenue_funded_organic: number;
  revenue_funded: number;
  revenue_organic: number;
  revenue_mailing: number;
};

const EMPTY_METRICS: DivisionMetrics = {
  leads_funded: 0,
  leads_organic: 0,
  leads_mailing: 0,
  invalid_leads_funded: 0,
  arrivals_funded_organic: 0,
  arrivals_funded: 0,
  arrivals_organic: 0,
  arrivals_mailing: 0,
  coordinations_funded_organic: 0,
  coordinations_funded: 0,
  coordinations_organic: 0,
  coordinations_mailing: 0,
  closings_funded_organic: 0,
  closings_funded: 0,
  closings_organic: 0,
  closings_mailing: 0,
  revenue_funded_organic: 0,
  revenue_funded: 0,
  revenue_organic: 0,
  revenue_mailing: 0,
};

export type InvalidReason = { reason: string; count: number };

export type MailingTagBreakdown = {
  tag: string;
  leads: number;
  coordinations: number;
  arrivals: number;
  closings: number;
  revenue: number;
};

export type RapidCategory = { category: string; division: Division | null; amount: number };

export type LastUpdated = {
  rapidSales: string | null;
  referrals: string | null;
  budget: string | null;
  zohoSync: string | null;
};

export type BranchMetrics = {
  meetings: number;
  arrivals: number;
  coordinations: number;
  closings: number;
  revenue: number;
};

const EMPTY_BRANCH_METRICS: BranchMetrics = { meetings: 0, arrivals: 0, coordinations: 0, closings: 0, revenue: 0 };

export type BranchDivisionMetrics = { arrivals: number; coordinations: number; closings: number; revenue: number };

const EMPTY_BRANCH_DIVISION_METRICS: BranchDivisionMetrics = { arrivals: 0, coordinations: 0, closings: 0, revenue: 0 };

// Same branch / branch x division numbers, split by source channel (ממומן /
// אורגני / דיוורים) -- stored by the sync as "<metric>__<channel>" rows in the
// same two tables, see classifyChannel in transform.ts.
export type BranchChannelMetrics = {
  branch: Record<Branch, BranchMetrics>;
  division: Record<Branch, Record<Division, BranchDivisionMetrics>>;
};

// Rep isn't a fixed enum (open Zoho picklist), so this is a plain dynamic
// map rather than a Record<Branch, Record<Rep, ...>> keyed off a constant
// list like BranchDivisionMetrics above.
export type BranchRepMetrics = { arrivals: number; closings: number };

// Rep x division rows for the "יועצות" tab, passed through flat (one row per
// branch+rep+division[+metric]) -- the tab sums them client-side according to
// its own branch filter, so there's nothing to pre-shape here.
export type RepDivisionMetricRow = { branch: Branch; rep: string; division: Division; metric: string; value: number };
export type RapidRepDivision = Division | "products" | "other";
export type RapidRepDivisionRow = { branch: Branch; rep: string; division: RapidRepDivision; amount: number };

export type DashboardData = {
  hasSyncedData: boolean;
  asOf: string | null;
  monthLabel: string;
  divisions: Record<Division, DivisionMetrics>;
  invalidReasons: Record<Division, InvalidReason[]>;
  mailingTags: Record<Division, MailingTagBreakdown[]>;
  targets: Record<Division, Record<string, number>>;
  rapidActuals: Record<Division, Record<string, number>>;
  rapidCategories: RapidCategory[];
  spaUpgradesActual: Record<Division, number>;
  referralsActual: number;
  companyTargets: Record<string, number>;
  lastUpdated: LastUpdated;
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
  branchMetrics: Record<Branch, BranchMetrics>;
  branchDivisionMetrics: Record<Branch, Record<Division, BranchDivisionMetrics>>;
  branchRepMetrics: Record<Branch, Record<string, BranchRepMetrics>>;
  // null until the first sync that writes channel rows has run for the month.
  branchChannelMetrics: Record<Channel, BranchChannelMetrics> | null;
  rapidRevenueByBranch: Record<Branch, number>;
  rapidRepRevenueByBranch: Record<Branch, Record<string, number>>;
  repDivisionMetrics: RepDivisionMetricRow[];
  rapidRepDivisionRevenue: RapidRepDivisionRow[];
};

const REFERRALS_CATEGORY = "ירוקים (הפניות)";

const MONTH_NAMES_HE = [
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

export async function getDashboardData(month?: string): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const [reqYear, reqMonthNum] = month
    ? month.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const monthStart = `${reqYear}-${String(reqMonthNum).padStart(2, "0")}-01`;
  const isCurrentMonth = reqYear === now.getUTCFullYear() && reqMonthNum === now.getUTCMonth() + 1;
  const isFutureMonth =
    reqYear > now.getUTCFullYear() || (reqYear === now.getUTCFullYear() && reqMonthNum > now.getUTCMonth() + 1);

  const [
    { data: metricRows },
    { data: reasonRows },
    { data: mailingTagRows },
    { data: targetRows },
    { data: rapidRows },
    { data: categoryRows },
    { data: companyTargetRows },
    { data: branchMetricRows },
    { data: branchDivisionMetricRows },
    { data: branchRepMetricRows },
    { data: rapidBranchRows },
    { data: rapidBranchRepRows },
    { data: repDivisionRows },
    { data: rapidRepDivisionRows },
    { data: syncRunRows },
  ] = await Promise.all([
    supabase.from("zoho_metrics").select("division, metric, value, as_of").eq("month", monthStart),
    supabase.from("zoho_invalid_lead_reasons").select("division, reason, count").eq("month", monthStart),
    supabase.from("zoho_mailing_tags").select("division, tag, metric, value").eq("month", monthStart),
    supabase.from("manual_entries").select("division, metric, value").eq("kind", "target").eq("month", monthStart),
    supabase
      .from("manual_entries")
      .select("division, metric, value, updated_at")
      .eq("kind", "rapid_actual")
      .eq("month", monthStart),
    supabase.from("rapid_sales_categories").select("category, division, amount, synced_at").eq("month", monthStart),
    supabase.from("company_targets").select("metric, value").eq("month", monthStart),
    supabase.from("zoho_branch_metrics").select("branch, metric, value").eq("month", monthStart),
    supabase.from("zoho_branch_division_metrics").select("branch, division, metric, value").eq("month", monthStart),
    supabase.from("zoho_branch_rep_metrics").select("branch, rep, metric, value").eq("month", monthStart),
    supabase.from("rapid_sales_by_branch").select("branch, amount").eq("month", monthStart),
    supabase.from("rapid_sales_by_branch_rep").select("branch, rep, amount").eq("month", monthStart),
    supabase
      .from("zoho_branch_rep_division_metrics")
      .select("branch, rep, division, metric, value")
      .eq("month", monthStart),
    supabase.from("rapid_sales_by_branch_rep_division").select("branch, rep, division, amount").eq("month", monthStart),
    supabase
      .from("sync_runs")
      .select("finished_at")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1),
  ]);

  const divisions = Object.fromEntries(
    DIVISIONS.map((d) => [d, { ...EMPTY_METRICS }])
  ) as Record<Division, DivisionMetrics>;

  let asOf: string | null = null;
  for (const row of metricRows ?? []) {
    const division = row.division as Division;
    if (!divisions[division]) continue;
    (divisions[division] as unknown as Record<string, number>)[row.metric] = row.value;
    asOf = row.as_of;
  }

  const invalidReasons = Object.fromEntries(
    DIVISIONS.map((d) => [d, [] as InvalidReason[]])
  ) as Record<Division, InvalidReason[]>;
  for (const row of reasonRows ?? []) {
    const division = row.division as Division;
    if (!invalidReasons[division]) continue;
    invalidReasons[division].push({ reason: row.reason, count: row.count });
  }
  for (const division of DIVISIONS) {
    invalidReasons[division].sort((a, b) => b.count - a.count);
  }

  const mailingTagMap = Object.fromEntries(
    DIVISIONS.map((d) => [d, new Map<string, MailingTagBreakdown>()])
  ) as Record<Division, Map<string, MailingTagBreakdown>>;
  for (const row of mailingTagRows ?? []) {
    const division = row.division as Division;
    if (!mailingTagMap[division]) continue;
    const tag = row.tag as string;
    let entry = mailingTagMap[division].get(tag);
    if (!entry) {
      entry = { tag, leads: 0, coordinations: 0, arrivals: 0, closings: 0, revenue: 0 };
      mailingTagMap[division].set(tag, entry);
    }
    (entry as unknown as Record<string, number>)[row.metric] = row.value;
  }
  const mailingTags = Object.fromEntries(
    DIVISIONS.map((d) => [d, Array.from(mailingTagMap[d].values()).sort((a, b) => b.leads - a.leads)])
  ) as Record<Division, MailingTagBreakdown[]>;

  const targets = Object.fromEntries(
    DIVISIONS.map((d) => [d, {} as Record<string, number>])
  ) as Record<Division, Record<string, number>>;
  for (const row of targetRows ?? []) {
    const division = row.division as Division;
    if (!targets[division]) continue;
    targets[division][row.metric] = row.value;
  }

  const rapidActuals = Object.fromEntries(
    DIVISIONS.map((d) => [d, {} as Record<string, number>])
  ) as Record<Division, Record<string, number>>;
  for (const row of rapidRows ?? []) {
    const division = row.division as Division;
    if (!rapidActuals[division]) continue;
    rapidActuals[division][row.metric] = row.value;
  }

  const monthDateObj = new Date(Date.UTC(reqYear, reqMonthNum - 1, 1));
  const daysInMonth = new Date(Date.UTC(reqYear, reqMonthNum, 0)).getUTCDate();
  const daysElapsed = asOf
    ? new Date(asOf).getUTCDate()
    : isFutureMonth
      ? 0
      : isCurrentMonth
        ? Math.max(0, now.getUTCDate() - 1)
        : daysInMonth;

  const monthEndObj = new Date(Date.UTC(reqYear, reqMonthNum - 1, daysInMonth));
  const elapsedEndObj = asOf
    ? new Date(asOf)
    : isFutureMonth
      ? new Date(Date.UTC(reqYear, reqMonthNum - 1, 1))
      : isCurrentMonth
        ? new Date(Date.UTC(reqYear, reqMonthNum - 1, Math.max(1, now.getUTCDate() - 1)))
        : monthEndObj;

  const workDaysInMonth = workDaysBetween(monthDateObj, monthEndObj);
  const workDaysElapsed = workDaysBetween(monthDateObj, elapsedEndObj);

  const companyTargets = Object.fromEntries((companyTargetRows ?? []).map((row) => [row.metric, row.value]));

  const rapidCategories = (categoryRows ?? [])
    .map((row) => ({
      category: row.category as string,
      division: (row.division as Division | null) ?? null,
      amount: row.amount as number,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ירוקים (referrals) has no division column in its own Rapid report, but
  // Meital's own tracking attributes the entire company-wide figure to ymax
  // specifically -- exposed here so the ymax tab can show its real actual
  // (not just a target placeholder) instead of redirecting to the overview.
  const referralsActual = rapidCategories
    .filter((c) => c.division === null && c.category === REFERRALS_CATEGORY)
    .reduce((s, c) => s + c.amount, 0);

  // ספה ושדרוגים actual -- NOT the raw Rapid category total for a division.
  // Rapid POS records EVERY payment collected (CRM-tracked deals, walk-in
  // upsells alike), so the raw category total for e.g. ymax already INCLUDES
  // whatever Zoho separately recorded as revenue_funded_organic/revenue_mailing
  // for the same underlying payments. Adding both would double-count real
  // money. The residual -- Rapid's total minus what Zoho already explains --
  // is the real ספה ושדרוגים figure. ירוקים (referrals) is its own separate
  // Rapid category with no division (division=null), so it's never part of
  // any division's `rapidTotal` filter below to begin with -- it must NOT be
  // subtracted again here (a prior version subtracted the company-wide
  // referrals total from ymax specifically, which silently erased ₪91,600 of
  // real ymax money that was never double-counted in the first place --
  // caught and fixed 2026-09-15 after Meital flagged ymax's total not matching
  // its two raw category rows: 774,374.99 + 7,450 should net to 781,824.99,
  // not 690,224.99).
  const spaUpgradesActual = Object.fromEntries(
    DIVISIONS.map((d) => {
      const rapidTotal = rapidCategories.filter((c) => c.division === d).reduce((s, c) => s + c.amount, 0);
      if (rapidTotal > 0) {
        const zohoRevenue = divisions[d].revenue_funded_organic + divisions[d].revenue_mailing;
        return [d, rapidTotal - zohoRevenue];
      }
      // No Rapid import yet for this division/month -- fall back to a
      // manually-entered ספה ושדרוגים actual (already assumed net, not a raw
      // category total, so no subtraction here).
      return [d, rapidActuals[d]?.revenue_spa_upgrades ?? 0];
    })
  ) as Record<Division, number>;

  const branchMetrics = Object.fromEntries(
    BRANCHES.map((b) => [b, { ...EMPTY_BRANCH_METRICS }])
  ) as Record<Branch, BranchMetrics>;
  for (const row of branchMetricRows ?? []) {
    const branch = row.branch as Branch;
    if (!branchMetrics[branch] || row.metric.includes("__")) continue;
    (branchMetrics[branch] as unknown as Record<string, number>)[row.metric] = row.value;
  }

  const branchDivisionMetrics = Object.fromEntries(
    BRANCHES.map((b) => [
      b,
      Object.fromEntries(DIVISIONS.map((d) => [d, { ...EMPTY_BRANCH_DIVISION_METRICS }])) as Record<
        Division,
        BranchDivisionMetrics
      >,
    ])
  ) as Record<Branch, Record<Division, BranchDivisionMetrics>>;
  for (const row of branchDivisionMetricRows ?? []) {
    const branch = row.branch as Branch;
    const division = row.division as Division;
    if (!branchDivisionMetrics[branch]?.[division] || row.metric.includes("__")) continue;
    (branchDivisionMetrics[branch][division] as unknown as Record<string, number>)[row.metric] = row.value;
  }

  const emptyChannelMetrics = (): BranchChannelMetrics => ({
    branch: Object.fromEntries(BRANCHES.map((b) => [b, { ...EMPTY_BRANCH_METRICS }])) as Record<Branch, BranchMetrics>,
    division: Object.fromEntries(
      BRANCHES.map((b) => [b, Object.fromEntries(DIVISIONS.map((d) => [d, { ...EMPTY_BRANCH_DIVISION_METRICS }]))])
    ) as Record<Branch, Record<Division, BranchDivisionMetrics>>,
  });
  const channelMetrics = Object.fromEntries(CHANNELS.map((c) => [c, emptyChannelMetrics()])) as Record<
    Channel,
    BranchChannelMetrics
  >;
  let hasChannelRows = false;
  for (const row of branchMetricRows ?? []) {
    const [metric, channel] = (row.metric as string).split("__") as [string, Channel | undefined];
    const target = channel && channelMetrics[channel]?.branch[row.branch as Branch];
    if (!target) continue;
    (target as unknown as Record<string, number>)[metric] = row.value;
    hasChannelRows = true;
  }
  for (const row of branchDivisionMetricRows ?? []) {
    const [metric, channel] = (row.metric as string).split("__") as [string, Channel | undefined];
    const target = channel && channelMetrics[channel]?.division[row.branch as Branch]?.[row.division as Division];
    if (!target) continue;
    (target as unknown as Record<string, number>)[metric] = row.value;
  }
  const branchChannelMetrics = hasChannelRows ? channelMetrics : null;

  const branchRepMetrics = Object.fromEntries(BRANCHES.map((b) => [b, {} as Record<string, BranchRepMetrics>])) as Record<
    Branch,
    Record<string, BranchRepMetrics>
  >;
  for (const row of branchRepMetricRows ?? []) {
    const branch = row.branch as Branch;
    if (!branchRepMetrics[branch]) continue;
    const rep = row.rep as string;
    if (!branchRepMetrics[branch][rep]) branchRepMetrics[branch][rep] = { arrivals: 0, closings: 0 };
    (branchRepMetrics[branch][rep] as unknown as Record<string, number>)[row.metric] = row.value;
  }

  const rapidRevenueByBranch = Object.fromEntries(BRANCHES.map((b) => [b, 0])) as Record<Branch, number>;
  for (const row of rapidBranchRows ?? []) {
    const branch = row.branch as Branch;
    if (branch in rapidRevenueByBranch) rapidRevenueByBranch[branch] = row.amount as number;
  }

  // Rapid revenue by rep (צוות מכירות) -- a separate cross-section of the
  // same SalesReport import, purely so the branch tab can show it next to
  // zoho_branch_rep_metrics for the same branch and let the two sources be
  // compared side by side (rep names come from two different open-text
  // fields in two different systems, so they aren't reconciled/matched here
  // -- both lists are just shown as-is).
  const rapidRepRevenueByBranch = Object.fromEntries(BRANCHES.map((b) => [b, {} as Record<string, number>])) as Record<
    Branch,
    Record<string, number>
  >;
  for (const row of rapidBranchRepRows ?? []) {
    const branch = row.branch as Branch;
    if (!rapidRepRevenueByBranch[branch]) continue;
    rapidRepRevenueByBranch[branch][row.rep as string] = row.amount as number;
  }

  const maxTimestamp = (timestamps: (string | null | undefined)[]): string | null =>
    timestamps.filter((t): t is string => Boolean(t)).sort().at(-1) ?? null;

  const lastUpdated: LastUpdated = {
    rapidSales: maxTimestamp(
      (categoryRows ?? []).filter((r) => r.category !== REFERRALS_CATEGORY).map((r) => r.synced_at)
    ),
    referrals: maxTimestamp((categoryRows ?? []).filter((r) => r.category === REFERRALS_CATEGORY).map((r) => r.synced_at)),
    budget: maxTimestamp((rapidRows ?? []).filter((r) => r.metric === "budget_funded").map((r) => r.updated_at)),
    zohoSync: syncRunRows?.[0]?.finished_at ?? null,
  };

  return {
    hasSyncedData: (metricRows?.length ?? 0) > 0,
    asOf,
    monthLabel: `${MONTH_NAMES_HE[reqMonthNum - 1]} ${reqYear}`,
    divisions,
    invalidReasons,
    mailingTags,
    targets,
    rapidActuals,
    rapidCategories,
    spaUpgradesActual,
    referralsActual,
    companyTargets,
    lastUpdated,
    daysElapsed,
    daysInMonth,
    workDaysElapsed,
    workDaysInMonth,
    branchMetrics,
    branchDivisionMetrics,
    branchChannelMetrics,
    branchRepMetrics,
    rapidRevenueByBranch,
    rapidRepRevenueByBranch,
    repDivisionMetrics: (repDivisionRows ?? []).map((r) => ({
      branch: r.branch as Branch,
      rep: r.rep as string,
      division: r.division as Division,
      metric: r.metric as string,
      value: Number(r.value),
    })),
    rapidRepDivisionRevenue: (rapidRepDivisionRows ?? []).map((r) => ({
      branch: r.branch as Branch,
      rep: r.rep as string,
      division: r.division as RapidRepDivision,
      amount: Number(r.amount),
    })),
  };
}
