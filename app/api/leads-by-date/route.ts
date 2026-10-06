import { NextResponse } from "next/server";
import {
  fetchLeadsForDateRange,
  fetchCoordinationsForDateRange,
  fetchInvalidLeadsForDateRange,
  type LeadRow,
  type InvalidLeadRow,
} from "@/lib/zoho/queries";
import { classifyPaidOrganic, classifyDivisionFromSource, aggregateInvalidLeads, DIVISIONS, type Division } from "@/lib/zoho/transform";

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

type InvalidDivisionGroup = { division: Division; total: number; reasons: { reason: string; count: number }[] };
type InvalidGroup = { total: number; divisions: InvalidDivisionGroup[] };

// Invalid leads are classified by `type` (not Lead_Source text, per the
// standing "everything except leads count uses type" rule) -- reuses the
// same aggregateInvalidLeads used by the monthly sync. Split into
// ממומן/אורגני via classifyPaidOrganic (same as groupByTypeAndDivision
// above) so Meital can see the field90 breakdown on both, not just ממומן --
// unlike the "invalid_leads_funded" metric used elsewhere on the dashboard,
// which is ממומן-only by design.
function buildInvalidGroup(rows: InvalidLeadRow[]): InvalidGroup {
  const { metrics, reasons } = aggregateInvalidLeads(rows);
  const divisions = DIVISIONS.map((division) => ({
    division,
    total: metrics.find((m) => m.division === division)?.value ?? 0,
    reasons: reasons
      .filter((r) => r.division === division)
      .map((r) => ({ reason: r.reason, count: r.count }))
      .sort((a, b) => b.count - a.count),
  })).filter((d) => d.total > 0);

  return { total: rows.length, divisions };
}

function buildInvalidSummary(rows: InvalidLeadRow[]): { funded: InvalidGroup; organic: InvalidGroup } {
  return {
    funded: buildInvalidGroup(rows.filter((r) => classifyPaidOrganic(r.Lead_Source) === "paid")),
    organic: buildInvalidGroup(rows.filter((r) => classifyPaidOrganic(r.Lead_Source) === "organic")),
  };
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
    const [rows, coordinationRows, invalidRows] = await Promise.all([
      fetchLeadsForDateRange(from, to),
      fetchCoordinationsForDateRange(from, to),
      fetchInvalidLeadsForDateRange(from, to),
    ]);
    const funded = groupByTypeAndDivision(rows, "paid");
    const organic = groupByTypeAndDivision(rows, "organic");
    const coordinationsFunded = groupByTypeAndDivision(coordinationRows, "paid");
    const coordinationsOrganic = groupByTypeAndDivision(coordinationRows, "organic");

    return NextResponse.json({
      from,
      to,
      total: rows.length,
      funded,
      organic,
      invalid: buildInvalidSummary(invalidRows),
      coordinations: {
        total: coordinationRows.length,
        funded: coordinationsFunded,
        organic: coordinationsOrganic,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
