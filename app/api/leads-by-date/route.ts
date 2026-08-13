import { NextResponse } from "next/server";
import { fetchLeadsForDateRange, type LeadRow } from "@/lib/zoho/queries";
import { classifyPaidOrganic, classifyDivisionFromSource, DIVISIONS, type Division } from "@/lib/zoho/transform";

// Live on-demand report for the "לידים לפי תאריך" tab -- runs its own Zoho
// query for whatever range the user picks, separate from the daily
// zoho_metrics sync. Protected by proxy.ts (cookie session), same as every
// other non-/api/sync route.
export const maxDuration = 60;

type SourceCount = { source: string; count: number };
type DivisionGroup = { division: Division | null; total: number; sources: SourceCount[] };

function groupByTypeAndDivision(rows: LeadRow[], kind: "paid" | "organic"): { total: number; divisions: DivisionGroup[] } {
  const kindRows = rows.filter((r) => classifyPaidOrganic(r.Lead_Source) === kind);

  const byDivision = new Map<Division | null, LeadRow[]>();
  for (const row of kindRows) {
    const division = classifyDivisionFromSource(row.Lead_Source, row.type);
    if (!byDivision.has(division)) byDivision.set(division, []);
    byDivision.get(division)!.push(row);
  }

  const divisions: DivisionGroup[] = [...DIVISIONS, null]
    .map((division) => {
      const divRows = byDivision.get(division) ?? [];
      const bySource = new Map<string, number>();
      for (const row of divRows) {
        const source = row.Lead_Source || "(ריק)";
        bySource.set(source, (bySource.get(source) ?? 0) + 1);
      }
      const sources = [...bySource.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);
      return { division, total: divRows.length, sources };
    })
    // Always show all 5 real divisions (even at 0, like the mockup) --
    // only drop the unclassified (division=null) bucket when it's empty.
    .filter((d) => d.total > 0 || d.division !== null);

  return { total: kindRows.length, divisions };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Missing or invalid from/to query params (expected YYYY-MM-DD)" }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: "'to' date is before 'from' date" }, { status: 400 });
  }

  try {
    const rows = await fetchLeadsForDateRange(from, to);
    const funded = groupByTypeAndDivision(rows, "paid");
    const organic = groupByTypeAndDivision(rows, "organic");

    return NextResponse.json({ from, to, total: rows.length, funded, organic });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
