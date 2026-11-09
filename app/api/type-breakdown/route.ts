import { NextResponse } from "next/server";
import {
  fetchLeadsForMonth,
  fetchInvalidLeadsForMonth,
  fetchCoordinationsForMonth,
  fetchArrivalsForMonth,
  fetchClosingsForMonth,
} from "@/lib/zoho/queries";
import { monthRangeFor } from "@/lib/zoho/dateRanges";
import { aggregateTypeFunnel } from "@/lib/zoho/typeBreakdown";
import { DIVISIONS, type Division } from "@/lib/zoho/transform";

// Live per-`type` funnel for one division and month (the TYPE table on the
// קד"ב division tabs). Pulled straight from Zoho on request -- same queries
// and date rules as the nightly sync (current month capped at yesterday),
// so no new Supabase table is needed. Protected by proxy.ts (cookie session).
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const division = searchParams.get("division") as Division | null;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Missing or invalid month (expected YYYY-MM)" }, { status: 400 });
  }
  if (!division || !DIVISIONS.includes(division)) {
    return NextResponse.json({ error: "Missing or invalid division" }, { status: 400 });
  }

  const range = monthRangeFor(month);
  if (range.yesterdayDateStr < range.monthStartDateStr) {
    // First day of the current month -- nothing has happened yet.
    return NextResponse.json({ month, division, from: range.monthStartDateStr, to: null, rows: [] });
  }

  try {
    const [leads, invalid, coordinations, arrivals, closings] = await Promise.all([
      fetchLeadsForMonth(range),
      fetchInvalidLeadsForMonth(range),
      fetchCoordinationsForMonth(range),
      fetchArrivalsForMonth(range),
      fetchClosingsForMonth(range),
    ]);
    const rows = aggregateTypeFunnel(division, { leads, invalid, coordinations, arrivals, closings });
    return NextResponse.json({
      month,
      division,
      from: range.monthStartDateStr,
      to: range.yesterdayDateStr,
      rows,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
