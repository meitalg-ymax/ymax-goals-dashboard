import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, BRANCHES, type Division, type Branch } from "@/lib/zoho/transform";
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
  closings: number;
  revenue: number;
};

const EMPTY_BRANCH_METRICS: BranchMetrics = { meetings: 0, arrivals: 0, closings: 0, revenue: 0 };

export type BranchDivisionMetrics = { arrivals: number; closings: number; revenue: number };

const EMPTY_BRANCH_DIVISION_METRICS: BranchDivisionMetrics = { arrivals: 0, closings: 0, revenue: 0 };

export type DashboardData = {
  hasSyncedData: boolean;
  asOf: string | null;
  monthLabel: string;
  divisions: Record<Division, DivisionMetrics>;
  invalidReasons: Record<Division, InvalidReason[]>;
  targets: Record<Division, Record<string, number>>;
  rapidActuals: Record<Division, Record<string, number>>;
  rapidCategories: RapidCategory[];
  spaUpgradesActual: Record<Division, number>;
  companyTargets: Record<string, number>;
  lastUpdated: LastUpdated;
  daysElapsed: number;
  daysInMonth: number;
  workDaysElapsed: number;
  workDaysInMonth: number;
  branchMetrics: Record<Branch, BranchMetrics>;
  branchDivisionMetrics: Record<Branch, Record<Division, BranchDivisionMetrics>>;
  rapidRevenueByBranch: Record<Branch, number>;
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

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const [
    { data: metricRows },
    { data: reasonRows },
    { data: targetRows },
    { data: rapidRows },
    { data: categoryRows },
    { data: companyTargetRows },
    { data: branchMetricRows },
    { data: branchDivisionMetricRows },
    { data: rapidBranchRows },
    { data: syncRunRows },
  ] = await Promise.all([
    supabase.from("zoho_metrics").select("division, metric, value, as_of").eq("month", monthStart),
    supabase.from("zoho_invalid_lead_reasons").select("division, reason, count").eq("month", monthStart),
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
    supabase.from("rapid_sales_by_branch").select("branch, amount").eq("month", monthStart),
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

  const monthDateObj = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = asOf ? new Date(asOf).getUTCDate() : Math.max(0, now.getUTCDate() - 1);

  const monthEndObj = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), daysInMonth));
  const elapsedEndObj = asOf
    ? new Date(asOf)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.max(1, now.getUTCDate() - 1)));

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

  const referralsTotal = rapidCategories
    .filter((c) => c.division === null && c.category === REFERRALS_CATEGORY)
    .reduce((s, c) => s + c.amount, 0);

  // ספה ושדרוגים actual -- NOT the raw Rapid category total for a division.
  // Rapid POS records EVERY payment collected (CRM-tracked deals, referral
  // clients, walk-in upsells alike), so the raw category total for e.g. ymax
  // already INCLUDES whatever Zoho separately recorded as revenue_funded_organic
  // /revenue_mailing for the same underlying payments. Adding both would
  // double-count real money (confirmed with Meital 2026-08-16, who does this
  // subtraction herself: "כסף ראפיד זה הסך הכל הכללי... צריך להוריד ממנו
  // ירוקים והכנסות של הזוהו... כדי לקבל ספה ושדרוגים"). The residual --
  // Rapid's total minus what Zoho already explains -- is the real ספה
  // ושדרוגים figure. ירוקים (referrals) has no division breakdown in Rapid
  // itself, but Meital's own tracking attributes the ENTIRE company-wide
  // referrals figure to ymax specifically (confirmed 2026-08-16, matching
  // her live tracking sheet exactly) -- every other division's Rapid total
  // has no referrals mixed in, so only ymax subtracts it.
  const spaUpgradesActual = Object.fromEntries(
    DIVISIONS.map((d) => {
      const rapidTotal = rapidCategories.filter((c) => c.division === d).reduce((s, c) => s + c.amount, 0);
      if (rapidTotal > 0) {
        const zohoRevenue = divisions[d].revenue_funded_organic + divisions[d].revenue_mailing;
        const referralsDeduction = d === "ymax" ? referralsTotal : 0;
        return [d, rapidTotal - zohoRevenue - referralsDeduction];
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
    if (!branchMetrics[branch]) continue;
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
    if (!branchDivisionMetrics[branch]?.[division]) continue;
    (branchDivisionMetrics[branch][division] as unknown as Record<string, number>)[row.metric] = row.value;
  }

  const rapidRevenueByBranch = Object.fromEntries(BRANCHES.map((b) => [b, 0])) as Record<Branch, number>;
  for (const row of rapidBranchRows ?? []) {
    const branch = row.branch as Branch;
    if (branch in rapidRevenueByBranch) rapidRevenueByBranch[branch] = row.amount as number;
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
    monthLabel: `${MONTH_NAMES_HE[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    divisions,
    invalidReasons,
    targets,
    rapidActuals,
    rapidCategories,
    spaUpgradesActual,
    companyTargets,
    lastUpdated,
    daysElapsed,
    daysInMonth,
    workDaysElapsed,
    workDaysInMonth,
    branchMetrics,
    branchDivisionMetrics,
    rapidRevenueByBranch,
  };
}
