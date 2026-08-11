import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, type Division } from "@/lib/zoho/transform";

export type DivisionMetrics = {
  leads_funded: number;
  leads_organic: number;
  leads_mailing: number;
  invalid_leads_funded: number;
  arrivals_funded_organic: number;
  arrivals_mailing: number;
  closings_funded_organic: number;
  closings_mailing: number;
  revenue_funded_organic: number;
  revenue_mailing: number;
};

const EMPTY_METRICS: DivisionMetrics = {
  leads_funded: 0,
  leads_organic: 0,
  leads_mailing: 0,
  invalid_leads_funded: 0,
  arrivals_funded_organic: 0,
  arrivals_mailing: 0,
  closings_funded_organic: 0,
  closings_mailing: 0,
  revenue_funded_organic: 0,
  revenue_mailing: 0,
};

export type InvalidReason = { reason: string; count: number };

export type DashboardData = {
  hasSyncedData: boolean;
  asOf: string | null;
  monthLabel: string;
  divisions: Record<Division, DivisionMetrics>;
  invalidReasons: Record<Division, InvalidReason[]>;
};

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

  const [{ data: metricRows }, { data: reasonRows }] = await Promise.all([
    supabase.from("zoho_metrics").select("division, metric, value, as_of").eq("month", monthStart),
    supabase.from("zoho_invalid_lead_reasons").select("division, reason, count").eq("month", monthStart),
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

  return {
    hasSyncedData: (metricRows?.length ?? 0) > 0,
    asOf,
    monthLabel: `${MONTH_NAMES_HE[now.getUTCMonth()]} ${now.getUTCFullYear()}`,
    divisions,
    invalidReasons,
  };
}
