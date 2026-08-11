import { createServiceClient } from "@/lib/supabase/service";
import { currentMonthToYesterday } from "./dateRanges";
import {
  fetchLeadsForMonth,
  fetchInvalidLeadsForMonth,
  fetchArrivalsForMonth,
  fetchClosingsForMonth,
  fetchMailingLeadsForMonth,
} from "./queries";
import {
  aggregateLeads,
  aggregateInvalidLeads,
  aggregateArrivals,
  aggregateClosingsAndRevenue,
  aggregateMailingLeads,
  type MetricRow,
} from "./transform";

export type SyncResult = {
  monthStartDateStr: string;
  yesterdayDateStr: string;
  metricsWritten: number;
  reasonsWritten: number;
};

export async function runZohoSync(
  triggeredBy: "cron" | "on_demand",
  today: Date = new Date()
): Promise<SyncResult> {
  const supabase = createServiceClient();
  const range = currentMonthToYesterday(today);

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select()
    .single();
  if (runError) throw new Error(`Failed to create sync_runs row: ${runError.message}`);

  try {
    const [leadsRows, invalidRows, arrivalsRows, closingsRows, mailingLeadsRows] = await Promise.all([
      fetchLeadsForMonth(range),
      fetchInvalidLeadsForMonth(range),
      fetchArrivalsForMonth(range),
      fetchClosingsForMonth(range),
      fetchMailingLeadsForMonth(range),
    ]);

    const { metrics: invalidMetrics, reasons } = aggregateInvalidLeads(invalidRows);

    const allMetrics: MetricRow[] = [
      ...aggregateLeads(leadsRows),
      ...aggregateMailingLeads(mailingLeadsRows),
      ...invalidMetrics,
      ...aggregateArrivals(arrivalsRows),
      ...aggregateClosingsAndRevenue(closingsRows),
    ];

    const metricUpserts = allMetrics.map((m) => ({
      month: range.monthStartDateStr,
      division: m.division,
      metric: m.metric,
      value: m.value,
      as_of: range.yesterdayDateStr,
      synced_at: new Date().toISOString(),
    }));

    const { error: metricsError } = await supabase
      .from("zoho_metrics")
      .upsert(metricUpserts, { onConflict: "month,division,metric" });
    if (metricsError) throw new Error(`Failed to upsert zoho_metrics: ${metricsError.message}`);

    // Reasons can change month to month (a reason can disappear entirely),
    // so replace the whole month+division set rather than upserting piecemeal.
    const { error: deleteReasonsError } = await supabase
      .from("zoho_invalid_lead_reasons")
      .delete()
      .eq("month", range.monthStartDateStr);
    if (deleteReasonsError) {
      throw new Error(`Failed to clear old zoho_invalid_lead_reasons: ${deleteReasonsError.message}`);
    }

    const reasonInserts = reasons.map((r) => ({
      division: r.division,
      reason: r.reason,
      count: r.count,
      month: range.monthStartDateStr,
      synced_at: new Date().toISOString(),
    }));

    if (reasonInserts.length > 0) {
      const { error: reasonsError } = await supabase
        .from("zoho_invalid_lead_reasons")
        .insert(reasonInserts);
      if (reasonsError) throw new Error(`Failed to insert zoho_invalid_lead_reasons: ${reasonsError.message}`);
    }

    await supabase
      .from("sync_runs")
      .update({ status: "success", finished_at: new Date().toISOString() })
      .eq("id", run.id);

    return {
      monthStartDateStr: range.monthStartDateStr,
      yesterdayDateStr: range.yesterdayDateStr,
      metricsWritten: metricUpserts.length,
      reasonsWritten: reasonInserts.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("sync_runs")
      .update({ status: "error", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    throw err;
  }
}
