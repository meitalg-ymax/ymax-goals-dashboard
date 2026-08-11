import { ManualEntryScreen } from "@/components/forms/ManualEntryScreen";
import { getManualEntries } from "@/lib/dashboard/manualEntries";
import { metricsForKind, groupsForKind } from "@/lib/metrics/catalog";
import { DIVISIONS, type Division } from "@/lib/zoho/transform";
import { saveRapidActuals } from "./actions";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function RapidPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; division?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const monthDate = `${month}-01`;
  const initialDivision = DIVISIONS.includes(params.division as Division) ? (params.division as Division) : undefined;

  const data = await getManualEntries("rapid_actual", monthDate);

  async function save(division: Parameters<typeof saveRapidActuals>[1], values: Record<string, number>) {
    "use server";
    await saveRapidActuals(monthDate, division, values);
  }

  return (
    <ManualEntryScreen
      title="הזנת נתונים ידניים (תקציב בפועל, ספה, שדרוגים)"
      basePath="/rapid"
      month={month}
      initialDivision={initialDivision}
      metrics={metricsForKind("rapid_actual")}
      groups={groupsForKind("rapid_actual")}
      data={data}
      onSave={save}
    />
  );
}
