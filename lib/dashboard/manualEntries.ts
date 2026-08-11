import { createClient } from "@/lib/supabase/server";
import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import type { MetricKind } from "@/lib/metrics/catalog";

// All values for one kind+month, keyed by division then metric.
export type ManualEntriesByDivision = Record<Division, Record<string, number>>;

export async function getManualEntries(kind: MetricKind, month: string): Promise<ManualEntriesByDivision> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manual_entries")
    .select("division, metric, value")
    .eq("kind", kind)
    .eq("month", month);

  if (error) throw new Error(`Failed to load manual_entries: ${error.message}`);

  const result = Object.fromEntries(DIVISIONS.map((d) => [d, {} as Record<string, number>])) as ManualEntriesByDivision;

  for (const row of data ?? []) {
    const division = row.division as Division;
    if (!result[division]) continue;
    result[division][row.metric] = row.value;
  }

  return result;
}
