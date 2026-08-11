import { createClient } from "@/lib/supabase/server";

export async function getCompanyTargets(month: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_targets").select("metric, value").eq("month", month);

  if (error) throw new Error(`Failed to load company_targets: ${error.message}`);

  return Object.fromEntries((data ?? []).map((row) => [row.metric, row.value]));
}
