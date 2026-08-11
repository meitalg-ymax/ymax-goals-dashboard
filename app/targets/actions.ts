"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { metricsForKind, COMPANY_TARGET_METRICS } from "@/lib/metrics/catalog";
import type { Division } from "@/lib/zoho/transform";

export async function saveTargets(month: string, division: Division, values: Record<string, number>) {
  const supabase = await createClient();
  const validKeys = new Set(metricsForKind("target").map((m) => m.key));

  const rows = Object.entries(values)
    .filter(([key]) => validKeys.has(key))
    .map(([metric, value]) => ({
      kind: "target" as const,
      month,
      division,
      metric,
      value,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("manual_entries").upsert(rows, {
    onConflict: "kind,month,division,metric",
  });
  if (error) throw new Error(`Failed to save targets: ${error.message}`);

  revalidatePath("/targets");
  revalidatePath("/");
}

export async function saveCompanyTargets(month: string, values: Record<string, number>) {
  const supabase = await createClient();
  const validKeys = new Set(COMPANY_TARGET_METRICS.map((m) => m.key));

  const rows = Object.entries(values)
    .filter(([key]) => validKeys.has(key))
    .map(([metric, value]) => ({ month, metric, value }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("company_targets").upsert(rows, { onConflict: "month,metric" });
  if (error) throw new Error(`Failed to save company targets: ${error.message}`);

  revalidatePath("/targets");
  revalidatePath("/");
}
