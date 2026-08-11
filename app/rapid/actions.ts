"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { metricsForKind } from "@/lib/metrics/catalog";
import type { Division } from "@/lib/zoho/transform";

export async function saveRapidActuals(month: string, division: Division, values: Record<string, number>) {
  const supabase = await createClient();
  const validKeys = new Set(metricsForKind("rapid_actual").map((m) => m.key));

  const rows = Object.entries(values)
    .filter(([key]) => validKeys.has(key))
    .map(([metric, value]) => ({
      kind: "rapid_actual" as const,
      month,
      division,
      metric,
      value,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("manual_entries").upsert(rows, {
    onConflict: "kind,month,division,metric",
  });
  if (error) throw new Error(`Failed to save Rapid actuals: ${error.message}`);

  revalidatePath("/rapid");
  revalidatePath("/");
}
