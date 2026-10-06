import { createServiceClient } from "@/lib/supabase/service";
import { currentMonthToYesterday, previousMonthFull, type MonthRange } from "./dateRanges";
import {
  fetchLeadsForMonth,
  fetchInvalidLeadsForMonth,
  fetchArrivalsForMonth,
  fetchCoordinationsForMonth,
  fetchClosingsForMonth,
  fetchMailingLeadsForMonth,
  fetchBranchMeetingsForMonth,
  fetchBranchArrivalsForMonth,
  fetchBranchCoordinationsForMonth,
  fetchBranchClosingsForMonth,
} from "./queries";
import {
  aggregateLeads,
  aggregateInvalidLeads,
  aggregateArrivals,
  aggregateCoordinations,
  aggregateClosingsAndRevenue,
  aggregateMailingLeads,
  aggregateMailingLeadsByTag,
  aggregateBranchMeetings,
  aggregateBranchArrivals,
  aggregateBranchCoordinations,
  aggregateBranchClosings,
  aggregateBranchDivisionArrivals,
  aggregateBranchDivisionCoordinations,
  aggregateBranchDivisionClosings,
  aggregateBranchRepArrivals,
  aggregateBranchRepClosings,
  aggregateBranchRepDivisionArrivals,
  aggregateBranchRepDivisionClosings,
  type MetricRow,
} from "./transform";

export type SyncResult = {
  monthStartDateStr: string;
  yesterdayDateStr: string;
  metricsWritten: number;
  mailingTagsWritten: number;
  reasonsWritten: number;
  branchMetricsWritten: number;
  branchDivisionMetricsWritten: number;
  branchRepMetricsWritten: number;
  branchRepDivisionMetricsWritten: number;
};

export async function runZohoSync(
  triggeredBy: "cron" | "on_demand",
  today: Date = new Date()
): Promise<SyncResult[]> {
  const supabase = createServiceClient();

  // Always sync the current month (running totals, capped at yesterday).
  // Additionally, on the cron run only and only in the first few days of a
  // new month, also finalize the PREVIOUS month in full: currentMonthToYesterday
  // tracks today's month, so once today rolls into a new month nothing ever
  // calls it for the month that just ended again -- that month's stored row
  // would otherwise stay frozen one day short of its real last day forever
  // (confirmed 2026-09-01: ymax leads_funded for August stuck at
  // as_of=2026-08-30, missing the 31st's leads). The 3-day window also gives
  // a buffer for any Zoho record edited a day or two after month-end.
  const ranges: MonthRange[] = [];
  if (triggeredBy === "cron" && today.getUTCDate() <= 3) {
    ranges.push(previousMonthFull(today));
  }
  ranges.push(currentMonthToYesterday(today));

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select()
    .single();
  if (runError) throw new Error(`Failed to create sync_runs row: ${runError.message}`);

  try {
    const results: SyncResult[] = [];
    for (const range of ranges) {
      results.push(await syncRange(supabase, range, triggeredBy));
    }

    await supabase
      .from("sync_runs")
      .update({ status: "success", finished_at: new Date().toISOString() })
      .eq("id", run.id);

    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("sync_runs")
      .update({ status: "error", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    throw err;
  }
}

async function syncRange(
  supabase: ReturnType<typeof createServiceClient>,
  range: MonthRange,
  triggeredBy: "cron" | "on_demand"
): Promise<SyncResult> {
  // leads_mailing (Tag-based) has no date cutoff -- Zoho doesn't expose
  // when a tag was applied, only its current live state, so this metric
  // can't be filtered to "up to yesterday" like every other query here.
  // To stop it drifting mid-day, it's only fetched/written on the nightly
  // cron run; an on-demand refresh (the dashboard's "רענון" button) leaves
  // whatever value the last cron run wrote untouched (confirmed with
  // Meital 2026-08-25).
  const [
    leadsRows,
    invalidRows,
    arrivalsRows,
    coordinationsRows,
    closingsRows,
    mailingLeadsRows,
    branchMeetingRows,
    branchArrivalRows,
    branchCoordinationRows,
    branchClosingRows,
  ] = await Promise.all([
    fetchLeadsForMonth(range),
    fetchInvalidLeadsForMonth(range),
    fetchArrivalsForMonth(range),
    fetchCoordinationsForMonth(range),
    fetchClosingsForMonth(range),
    triggeredBy === "cron" ? fetchMailingLeadsForMonth(range) : Promise.resolve(null),
    fetchBranchMeetingsForMonth(range),
    fetchBranchArrivalsForMonth(range),
    fetchBranchCoordinationsForMonth(range),
    fetchBranchClosingsForMonth(range),
  ]);

  const { metrics: invalidMetrics, reasons } = aggregateInvalidLeads(invalidRows);

  const allMetrics: MetricRow[] = [
    ...aggregateLeads(leadsRows),
    ...(mailingLeadsRows ? aggregateMailingLeads(mailingLeadsRows) : []),
    ...invalidMetrics,
    ...aggregateArrivals(arrivalsRows),
    ...aggregateCoordinations(coordinationsRows),
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

  // Per-tag mailing breakdown -- same cron-only guard as leads_mailing above
  // (mailingLeadsRows is null on an on-demand refresh, since Tag has no date
  // cutoff and would drift mid-day). On a non-cron run this table is simply
  // left untouched, same as the leads_mailing metric itself.
  let mailingTagsWritten = 0;
  if (mailingLeadsRows) {
    const tagMetrics = aggregateMailingLeadsByTag(mailingLeadsRows);

    const { error: deleteTagsError } = await supabase
      .from("zoho_mailing_tags")
      .delete()
      .eq("month", range.monthStartDateStr);
    if (deleteTagsError) {
      throw new Error(`Failed to clear old zoho_mailing_tags: ${deleteTagsError.message}`);
    }

    const tagInserts = tagMetrics.map((m) => ({
      month: range.monthStartDateStr,
      division: m.division,
      tag: m.tag,
      metric: m.metric,
      value: m.value,
      synced_at: new Date().toISOString(),
    }));

    if (tagInserts.length > 0) {
      const { error: tagsError } = await supabase.from("zoho_mailing_tags").insert(tagInserts);
      if (tagsError) throw new Error(`Failed to insert zoho_mailing_tags: ${tagsError.message}`);
    }
    mailingTagsWritten = tagInserts.length;
  }

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
    const { error: reasonsError } = await supabase.from("zoho_invalid_lead_reasons").insert(reasonInserts);
    if (reasonsError) throw new Error(`Failed to insert zoho_invalid_lead_reasons: ${reasonsError.message}`);
  }

  const branchMetrics = [
    ...aggregateBranchMeetings(branchMeetingRows),
    ...aggregateBranchArrivals(branchArrivalRows),
    ...aggregateBranchCoordinations(branchCoordinationRows),
    ...aggregateBranchClosings(branchClosingRows),
  ];
  const branchMetricUpserts = branchMetrics.map((m) => ({
    month: range.monthStartDateStr,
    branch: m.branch,
    metric: m.metric,
    value: m.value,
    as_of: range.yesterdayDateStr,
    synced_at: new Date().toISOString(),
  }));
  const { error: branchMetricsError } = await supabase
    .from("zoho_branch_metrics")
    .upsert(branchMetricUpserts, { onConflict: "month,branch,metric" });
  if (branchMetricsError) throw new Error(`Failed to upsert zoho_branch_metrics: ${branchMetricsError.message}`);

  const branchDivisionMetrics = [
    ...aggregateBranchDivisionArrivals(branchArrivalRows),
    ...aggregateBranchDivisionCoordinations(branchCoordinationRows),
    ...aggregateBranchDivisionClosings(branchClosingRows),
  ];
  const branchDivisionMetricUpserts = branchDivisionMetrics.map((m) => ({
    month: range.monthStartDateStr,
    branch: m.branch,
    division: m.division,
    metric: m.metric,
    value: m.value,
    as_of: range.yesterdayDateStr,
    synced_at: new Date().toISOString(),
  }));
  const { error: branchDivisionMetricsError } = await supabase
    .from("zoho_branch_division_metrics")
    .upsert(branchDivisionMetricUpserts, { onConflict: "month,branch,division,metric" });
  if (branchDivisionMetricsError) {
    throw new Error(`Failed to upsert zoho_branch_division_metrics: ${branchDivisionMetricsError.message}`);
  }

  const branchRepMetrics = [
    ...aggregateBranchRepArrivals(branchArrivalRows),
    ...aggregateBranchRepClosings(branchClosingRows),
  ];
  const branchRepMetricUpserts = branchRepMetrics.map((m) => ({
    month: range.monthStartDateStr,
    branch: m.branch,
    rep: m.rep,
    metric: m.metric,
    value: m.value,
    as_of: range.yesterdayDateStr,
    synced_at: new Date().toISOString(),
  }));
  const { error: branchRepMetricsError } = await supabase
    .from("zoho_branch_rep_metrics")
    .upsert(branchRepMetricUpserts, { onConflict: "month,branch,rep,metric" });
  if (branchRepMetricsError) {
    throw new Error(`Failed to upsert zoho_branch_rep_metrics: ${branchRepMetricsError.message}`);
  }

  // Rep x division -- full replace for the month (not upsert), since this
  // table only holds non-zero combos: a rep/division pair that drops to zero
  // (e.g. a lead reassigned to another rep) must disappear, not keep its
  // stale value. This sync job is the table's only writer.
  const branchRepDivisionMetrics = [
    ...aggregateBranchRepDivisionArrivals(branchArrivalRows),
    ...aggregateBranchRepDivisionClosings(branchClosingRows),
  ];
  const { error: deleteRepDivisionError } = await supabase
    .from("zoho_branch_rep_division_metrics")
    .delete()
    .eq("month", range.monthStartDateStr);
  if (deleteRepDivisionError) {
    throw new Error(`Failed to clear old zoho_branch_rep_division_metrics: ${deleteRepDivisionError.message}`);
  }
  const branchRepDivisionInserts = branchRepDivisionMetrics.map((m) => ({
    month: range.monthStartDateStr,
    branch: m.branch,
    rep: m.rep,
    division: m.division,
    metric: m.metric,
    value: m.value,
    as_of: range.yesterdayDateStr,
    synced_at: new Date().toISOString(),
  }));
  if (branchRepDivisionInserts.length > 0) {
    const { error: repDivisionError } = await supabase
      .from("zoho_branch_rep_division_metrics")
      .insert(branchRepDivisionInserts);
    if (repDivisionError) {
      throw new Error(`Failed to insert zoho_branch_rep_division_metrics: ${repDivisionError.message}`);
    }
  }

  return {
    monthStartDateStr: range.monthStartDateStr,
    yesterdayDateStr: range.yesterdayDateStr,
    metricsWritten: metricUpserts.length,
    mailingTagsWritten,
    reasonsWritten: reasonInserts.length,
    branchMetricsWritten: branchMetricUpserts.length,
    branchDivisionMetricsWritten: branchDivisionMetricUpserts.length,
    branchRepMetricsWritten: branchRepMetricUpserts.length,
    branchRepDivisionMetricsWritten: branchRepDivisionInserts.length,
  };
}
